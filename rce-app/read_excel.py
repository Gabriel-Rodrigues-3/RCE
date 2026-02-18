import openpyxl
import json
import sys

def read_excel(file_path):
    try:
        wb = openpyxl.load_workbook(file_path, data_only=True)
        sheet = wb.active
        
        data = []
        for row in sheet.iter_rows(min_row=1, max_row=10, values_only=True):
            if any(row):
                data.append(row)
        
        print(json.dumps(data, indent=2))
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        read_excel(sys.argv[1])
    else:
        print("Usage: python read_excel.py <file_path>")
