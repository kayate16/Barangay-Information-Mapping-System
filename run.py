#!/usr/bin/env python3
"""
Barangay Cagpile Information Mapping System
Run script for the Flask application
"""
from app import app

if __name__ == '__main__':
    print("=" * 60)
    print("🏠 BARANGAY CAGPILE INFORMATION MAPPING SYSTEM")
    print("=" * 60)
    print(f"📍 Barangay Cagpile, Oras, Eastern Samar")
    print(f"🌐 Server: http://{app.config['HOST']}:{app.config['PORT']}")
    print(f"🔧 Debug Mode: {app.config['DEBUG']}")
    print("=" * 60)
    
    app.run(
        debug=app.config['DEBUG'],
        host=app.config['HOST'],
        port=app.config['PORT']
    )