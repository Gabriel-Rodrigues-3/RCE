import openpyxl
import json
import sys

def read_excel(file_path):
    try:
        wb = openpyxl.load_workbook(file_path, data_only=True)
        sheet = wb.active
        
        data = []
        for row in sheet.iter_rows(values_only=True):
            if any(row):
                data.append(row)
        
        # Try to find a header row (containing common keywords)
        header_index = 0
        keywords = ['descri', 'item', 'quant', 'valor', 'unit', 'preço']
        for i, row in enumerate(data):
            row_str = " ".join([str(cell).lower() for cell in row if cell is not None])
            if any(kw in row_str for kw in keywords):
                header_index = i
                break
        
        result = {
            "headers": data[header_index],
            "rows": data[header_index+1 : header_index+11] # first 10 rows
        }
        
        print(json.dumps(result, indent=2))
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        read_excel(sys.argv[1])
    else:
        print("Usage: python read_excel.py <file_path>")
