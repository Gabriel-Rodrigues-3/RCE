
import openpyxl
import os
import re
import json
import requests

SUPABASE_URL = "https://pjetnagkckravvquceam.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqZXRuYWdrY2tyYXZ2cXVjZWFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwNzI1MzYsImV4cCI6MjA4NjY0ODUzNn0.iGreFq30EXrd4SirFulNUjBUGp284LiYIZweEw5fvo0"

def supabase_get(table, params=None):
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    response = requests.get(url, headers=headers, params=params)
    return response.json()

def supabase_post(table, data):
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    response = requests.post(url, headers={**headers, "Prefer": "return=representation"}, json=data)
    if response.status_code not in [200, 201]:
        print(f"  [ERROR] Supabase POST failed: {response.text}")
        return None
    return response.json()

def extract_customer_info(filename):
    # Example: SOMAS BOA ESPERANCA PE 49.xlsx
    name = filename.replace("SOMAS", "").replace(".xlsx", "").strip()
    pe_match = re.search(r"PE\s*(\d+(\.\d+)?)", name, re.IGNORECASE)
    pe = pe_match.group(1) if pe_match else "S/N"
    # Clean name: remove PE part
    clean_name = re.sub(r"PE\s*\d+(\.\d+)?", "", name, flags=re.IGNORECASE).strip()
    return clean_name, pe

def clean_text(text):
    if not text: return ""
    # Standardize: lowercase, keep only alphanumeric and spaces
    text = str(text).lower().strip()
    return re.sub(r'[^a-z0-9\s]', '', text)

def get_tokens(text):
    return set(clean_text(text).split())

def match_product(desc, product_map):
    if not desc: return None
    desc_tokens = get_tokens(desc)
    if not desc_tokens: return None
    
    # Try exact match first on cleaned text
    desc_clean = clean_text(desc)
    if desc_clean in product_map:
        return product_map[desc_clean]
    
    # Try token-based matching
    best_match = None
    best_score = 0
    
    for p_name, p_id in product_map.items():
        p_tokens = get_tokens(p_name)
        if not p_tokens: continue
        
        # Calculate intersection over union or just intersection
        intersection = desc_tokens.intersection(p_tokens)
        if not intersection: continue
        
        # Score = matches / total tokens in product name
        # If the product name tokens are almost all in the excel description, it's a strong match
        score = len(intersection) / len(p_tokens)
        
        if score > best_score:
            best_score = score
            best_match = p_id
            
    # Threshold for a "good" match - make it very strict to avoid merging distinct products
    if best_score > 0.95: 
        return best_match
    return None

def import_data():
    folder = r"C:\Users\Usuario\Downloads\RCE\SOMAS"
    files = [f for f in os.listdir(folder) if f.endswith('.xlsx') and 'SOMAS' in f]
    
    # Get all products for matching
    products = supabase_get("products", {"select": "id,name,sku"})
    product_map = {p['name']: p['id'] for p in products}

    for file in files:
        if "PADRÃO" in file: continue
        
        c_name, pe = extract_customer_info(file)
        print(f"\n--- Processing: {c_name} (PE: {pe}) ---")
        
        # Check for exact customer ID to avoid duplications
        existing = supabase_get("customers", {"name": f"eq.{c_name}", "select": "id"})
        if existing and isinstance(existing, list) and len(existing) > 0:
            customer_id = existing[0]['id']
        else:
            response = supabase_post("customers", {"name": c_name, "contract_number": pe, "status": "Ativo"})
            if not response: continue
            customer_id = response[0].get('id') if isinstance(response, list) else response.get('id')
        
        if not customer_id: continue
        
        wb = openpyxl.load_workbook(os.path.join(folder, file), data_only=True)
        sheet = wb.active
        
        customer_prods = []
        skipped_count = 0
        match_count = 0
        
        # Current active indices (dynamic)
        curr_desc_idx = None
        curr_price_idx = None
        curr_brand_idx = None
        
        row_count = 0
        for row in sheet.iter_rows(values_only=True):
            row_count += 1
            if not row: continue
            
            # Check if this row IS a header
            row_str = [str(c).upper() if c else "" for c in row]
            combined_row_str = "".join(row_str)
            
            if "DESCRI" in combined_row_str and any(x in combined_row_str for x in ["UNIT", "PRECO", "PREÇO", "VENDA", "VALOR"]):
                # Reset indices for this section - only pick the FIRST occurrence of each
                new_desc = None; new_brand = None; new_price = None
                for i, cell in enumerate(row_str):
                    if "DESCRI" in cell and new_desc is None: new_desc = i
                    if "MARCA" in cell and new_brand is None: new_brand = i
                    if any(x in cell for x in ["UNIT", "UNITARIO", "VENDA", "PREÇO", "PRECO", "VALOR"]) and new_price is None:
                        # Avoid picking up "VALOR TOTAL" if possible, but prioritize "UNIT"
                        if "TOTAL" not in cell or "UNIT" in cell:
                            new_price = i
                
                if new_desc is not None and new_price is not None:
                    curr_desc_idx = new_desc
                    curr_brand_idx = new_brand
                    curr_price_idx = new_price
                continue

            desc = None
            price = None
            brand = None

            # Heuristic 1: Use active header indices
            if curr_desc_idx is not None and curr_price_idx is not None:
                if len(row) > max(curr_desc_idx, curr_price_idx):
                    desc = row[curr_desc_idx]
                    price = row[curr_price_idx]
                    brand = row[curr_brand_idx] if curr_brand_idx is not None and len(row) > curr_brand_idx else None
            
            # Heuristic 2: Pattern-based fallback
            if not (desc and isinstance(price, (int, float))):
                desc = None; price = None; brand = None
                for i, cell in enumerate(row):
                    if isinstance(cell, str) and len(cell.strip()) > 15:
                        cand_desc = cell.strip()
                        # Look for price in a wider range
                        for j in range(i+1, min(i+20, len(row))):
                            val = row[j]
                            if isinstance(val, (int, float)) and 0.01 <= val < 10000:
                                desc = cand_desc
                                price = float(val)
                                break
                        if desc and price: break

            if "ARARAQUARA" in file and row_count < 150 and row_count > 110:
                print(f"    [ROW {row_count}] Detected: D={bool(desc)}, P={price}")

            if desc and price:
                # FINAL VALIDATION: Price must be numeric and not a summary word
                if not isinstance(price, (int, float)) or price <= 0:
                    try:
                        price = float(str(price).replace(',', '.'))
                        if price <= 0: continue
                    except:
                        continue
                
                u_desc = str(desc).upper()
                if any(x in u_desc for x in ["LOTE ", "TOTAL", "SUBTOTAL", "VALOR"]):
                    continue
                    
                prod_id = match_product(desc, product_map)
                
                if not prod_id:
                    # Auto-create missing product
                    print(f"    [NEW] {desc[:40]}...")
                    response = supabase_post("products", {"name": desc.strip()})
                    if response:
                        new_p = response[0] if isinstance(response, list) else response
                        prod_id = new_p.get('id')
                        # Update cache
                        product_map[clean_text(desc.strip())] = prod_id

                if prod_id:
                    customer_prods.append({
                        "customer_id": customer_id,
                        "product_id": prod_id,
                        "custom_price": price,
                        "custom_brand": str(brand) if brand else None
                    })
                    match_count += 1
                else:
                    print(f"    [SKIP] Row {row_count}: Failed to match/create product for '{desc[:40]}...'")
                    skipped_count += 1
            else:
                if row_count > 5: # Only log if we expect data
                    # print(f"    [SKIP] No D/P in Row {row_count}")
                    pass
        
        if customer_prods:
            # Deduplicate
            final_map = {p['product_id']: p for p in customer_prods}
            final_list = list(final_map.values())
            
            # Clear & Insert
            requests.delete(f"{SUPABASE_URL}/rest/v1/customer_products?customer_id=eq.{customer_id}", headers={
                "apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"
            })
            resp = supabase_post("customer_products", final_list)
            if resp:
                print(f"  [SUCCESS] Linked {len(final_list)} items ({skipped_count} skipped)")
            else:
                print(f"  [FAIL] Could not link items for {c_name}")
        else:
            print(f"  [WARNING] No products matched for this customer ({skipped_count} total rows checked)")

if __name__ == "__main__":
    import_data()
