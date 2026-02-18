import openpyxl
import os
import re

def clean_value(val):
    if val is None: return None
    if isinstance(val, str):
        return val.strip()
    return val

def format_sql_value(val):
    if val is None: return "NULL"
    if isinstance(val, (int, float)):
        return str(val)
    # Escape single quotes for SQL
    str_val = str(val).replace("'", "''")
    return f"'{str_val}'"

def run_migration():
    directory = r'C:\Users\Usuario\Downloads\RCE\SOMAS'
    files = [f for f in os.listdir(directory) if f.endswith('.xlsx')]
    
    unique_products = {} # key: description.lower()
    
    keywords = ['descri', 'item', 'quant', 'valor', 'unit', 'preço']
    
    print(f"-- Processing {len(files)} files...")

    for filename in files:
        file_path = os.path.join(directory, filename)
        try:
            wb = openpyxl.load_workbook(file_path, data_only=True)
            sheet = wb.active
            
            data = []
            for row in sheet.iter_rows(values_only=True):
                if any(row):
                    data.append(row)
            
            if not data: continue
            
            # Find header
            header_index = -1
            for i, row in enumerate(data):
                row_str = " ".join([str(cell).lower() for cell in row if cell is not None])
                if 'descri' in row_str and 'unit' in row_str:
                    header_index = i
                    break
            
            if header_index == -1: continue
            
            headers = [str(h).lower() if h else "" for h in data[header_index]]
            
            # Identify columns
            desc_col = -1
            unit_col = -1
            price_col = -1
            brand_col = -1
            
            for i, h in enumerate(headers):
                if 'descri' in h: desc_col = i
                elif 'unit' in h and 'valor' not in h: unit_col = i
                elif 'valor' in h and 'unit' in h: price_col = i
                elif 'marca' in h: brand_col = i
            
            if desc_col == -1: continue
            
            for row in data[header_index+1:]:
                desc = clean_value(row[desc_col])
                if not desc or len(str(desc)) < 5: continue
                
                key = str(desc).lower()
                if key not in unique_products:
                    # Basic extraction
                    unit = clean_value(row[unit_col]) if unit_col != -1 else "UN"
                    price = row[price_col] if price_col != -1 else 0
                    brand = clean_value(row[brand_col]) if brand_col != -1 else None
                    
                    if not isinstance(price, (int, float)): price = 0
                    
                    unique_products[key] = {
                        "name": desc,
                        "unit": unit,
                        "price": price,
                        "brand": brand
                    }
                    
        except Exception as e:
            print(f"-- Error in {filename}: {e}")

    # Generate SQL
    print(f"-- Found {len(unique_products)} unique products.")
    
    sql_header = "INSERT INTO products (name, description, unit, base_price, brand, stock_quantity) VALUES "
    values = []
    
    for p in unique_products.values():
        row_sql = f"({format_sql_value(p['name'])}, {format_sql_value(p['name'])}, {format_sql_value(p['unit'])}, {format_sql_value(p['price'])}, {format_sql_value(p['brand'])}, 100)"
        values.append(row_sql)
    
    # Chunking into 500 rows per insert to avoid size limits
    with open('scripts/migration.sql', 'w', encoding='utf-8') as f:
        f.write("-- Bulk Migration Script\n")
        chunk_size = 500
        for i in range(0, len(values), chunk_size):
            chunk = values[i:i + chunk_size]
            f.write(sql_header + ",\n".join(chunk) + ";\n")

if __name__ == "__main__":
    run_migration()
