import os

# Basic configuration
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
SECRET_KEY = os.environ.get('SECRET_KEY') or 'barangay-cagpile-secret-key-2024'

# Debug settings
DEBUG = True

# Server settings
HOST = '0.0.0.0'
PORT = 5000

# File paths
DATA_DIR = os.path.join(BASE_DIR, 'static', 'data', 'geojson')

# Map configuration
MAP_CONFIG = {
    'default_center': [12.2392, 125.3185],  # Barangay Cagpile coordinates
    'default_zoom': 16,
    'max_zoom': 20,
    'min_zoom': 12,
    'tile_layer': 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    'attribution': 'Barangay Cagpile Mapping System | OpenStreetMap contributors'
}

# Application settings
APP_NAME = 'Barangay Cagpile Information Mapping System'
VERSION = '2.0.0'
DESCRIPTION = 'A modern GIS-based mapping system for Barangay Cagpile, Oras, Eastern Samar'