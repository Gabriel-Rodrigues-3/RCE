import requests
import os

url = "https://n8n.srv1167396.hstgr.cloud/webhook/extract-ptc"
try:
    print(f"Testing connectivity to {url}...")
    # Sending a dummy file to simulate the app behavior
    files = {'PDF': ('test.pdf', b'%PDF-1.4 test', 'application/pdf')}
    response = requests.post(url, files=files, timeout=10)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")
