
import openpyxl
import os

folder = r"C:\Users\Usuario\Downloads\RCE\SOMAS"
files = [f for f in os.listdir(folder) if f.endswith('.xlsx') and 'SOMAS' in f]

for file in files[:3]: # Inspect first 3 files
    path = os.path.join(folder, file)
    print(f"\n--- File: {file} ---")
    try:
        wb = openpyxl.load_workbook(path, data_only=True)
        sheet = wb.active
        
        # Print first 5 rows to see structure
        for row in sheet.iter_rows(min_row=1, max_row=5, values_only=True):
            print(row)
    except Exception as e:
        print(f"Error reading {file}: {e}")
