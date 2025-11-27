from flask import Flask, render_template, jsonify, request, flash, redirect, url_for
import json
import os
from datetime import datetime
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config.from_pyfile('config.py')
app.secret_key = app.config['SECRET_KEY']

class DataManager:
    def __init__(self):
        self.data_dir = app.config['DATA_DIR']
        # Ensure data directory exists
        os.makedirs(self.data_dir, exist_ok=True)
        logger.info(f"Data directory: {self.data_dir}")
        
    def load_geojson_data(self):
        """Load all GeoJSON data files"""
        data = {}
        geojson_files = {
            'households': 'Cagpile_Households.geojson',
            'facilities': 'Cagpile_Facilities.geojson',
            'roads': 'Cagpile_Road.geojson',
            'boundary': 'Cagpile_Boundary.geojson'
        }
        
        for key, filename in geojson_files.items():
            file_path = os.path.join(self.data_dir, filename)
            logger.info(f"Looking for {filename} at: {file_path}")
            
            try:
                if os.path.exists(file_path):
                    with open(file_path, 'r', encoding='utf-8') as f:
                        data[key] = json.load(f)
                    logger.info(f"✅ Loaded {len(data[key]['features'])} features from {filename}")
                else:
                    data[key] = {'type': 'FeatureCollection', 'features': []}
                    logger.warning(f"⚠️ File not found: {file_path}")
            except Exception as e:
                logger.error(f"❌ Error loading {filename}: {str(e)}")
                data[key] = {'type': 'FeatureCollection', 'features': []}
        
        return data

    def save_geojson_data(self, data, layer_name):
        """Save GeoJSON data to file"""
        try:
            # Map layer names to correct file names
            file_mapping = {
                'households': 'Cagpile_Households.geojson',
                'facilities': 'Cagpile_Facilities.geojson',
                'roads': 'Cagpile_Road.geojson',
                'boundary': 'Cagpile_Boundary.geojson'
            }
            
            filename = file_mapping.get(layer_name, f'Cagpile_{layer_name.capitalize()}.geojson')
            file_path = os.path.join(self.data_dir, filename)
            
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            
            logger.info(f"✅ Saved {len(data['features'])} features to {filename}")
            return True, "Data saved successfully"
        except Exception as e:
            logger.error(f"❌ Error saving {layer_name}: {str(e)}")
            return False, str(e)

    def update_feature(self, layer_name, feature_id, new_properties, new_geometry=None):
        """Update a specific feature"""
        try:
            geojson_data = self.load_geojson_data()
            layer_data = geojson_data.get(layer_name)
            
            if not layer_data:
                return False, f"Layer {layer_name} not found"
            
            # Find and update the feature
            for feature in layer_data['features']:
                if str(feature['properties'].get('id')) == str(feature_id):
                    # Update properties
                    feature['properties'].update(new_properties)
                    
                    # Update geometry if provided
                    if new_geometry:
                        feature['geometry'] = new_geometry
                    
                    # Save the changes
                    success, message = self.save_geojson_data(layer_data, layer_name)
                    return success, message
            
            return False, f"Feature {feature_id} not found in {layer_name}"
        except Exception as e:
            return False, str(e)

    def delete_feature(self, layer_name, feature_id):
        """Delete a specific feature"""
        try:
            geojson_data = self.load_geojson_data()
            layer_data = geojson_data.get(layer_name)
            
            if not layer_data:
                return False, f"Layer {layer_name} not found"
            
            # Filter out the feature to delete
            original_count = len(layer_data['features'])
            layer_data['features'] = [
                feature for feature in layer_data['features']
                if str(feature['properties'].get('id')) != str(feature_id)
            ]
            
            if len(layer_data['features']) == original_count:
                return False, f"Feature {feature_id} not found in {layer_name}"
            
            # Save the changes
            success, message = self.save_geojson_data(layer_data, layer_name)
            return success, message
        except Exception as e:
            return False, str(e)

    def add_feature(self, layer_name, properties, geometry):
        """Add a new feature to the GeoJSON file"""
        try:
            geojson_data = self.load_geojson_data()
            layer_data = geojson_data.get(layer_name)
            
            if not layer_data:
                return False, f"Layer {layer_name} not found"
            
            # Generate ID if not provided
            if 'id' not in properties:
                existing_ids = [
                    f['properties'].get('id', 0) 
                    for f in layer_data['features'] 
                    if f['properties'].get('id')
                ]
                new_id = max(existing_ids) + 1 if existing_ids else 1
                properties['id'] = new_id
            
            # Create new feature
            new_feature = {
                'type': 'Feature',
                'properties': properties,
                'geometry': geometry
            }
            
            # Add to features list
            layer_data['features'].append(new_feature)
            
            # Save the changes
            success, message = self.save_geojson_data(layer_data, layer_name)
            return success, message
            
        except Exception as e:
            return False, str(e)

    def get_statistics(self, geojson_data=None):
        """Calculate comprehensive statistics from GeoJSON data"""
        if geojson_data is None:
            geojson_data = self.load_geojson_data()
        
        stats = {
            'total_households': 0,
            'total_residents': 0,
            'total_facilities': 0,
            'vulnerable_households': 0,
            'households_with_seniors': 0,
            'households_with_pwd': 0,
            'purok_distribution': {},
            'facility_types': {}
        }
        
        try:
            # Count households and residents
            households_data = geojson_data.get('households', {'features': []})
            stats['total_households'] = len(households_data['features'])
            
            for feature in households_data['features']:
                props = feature.get('properties', {})
                
                # Count residents
                residents = props.get('Residents')
                if residents is not None:
                    try:
                        stats['total_residents'] += int(residents)
                    except (ValueError, TypeError):
                        pass
                
                # Count vulnerable households
                senior_pwd = props.get('senior/PWD')
                if senior_pwd and str(senior_pwd).upper() == 'YES':
                    stats['vulnerable_households'] += 1
                
                # Count purok distribution
                purok = props.get('purok') or props.get('Purok')
                if purok:
                    stats['purok_distribution'][str(purok)] = stats['purok_distribution'].get(str(purok), 0) + 1
            
            # Count facilities
            facilities_data = geojson_data.get('facilities', {'features': []})
            stats['total_facilities'] = len(facilities_data['features'])
            
            for feature in facilities_data['features']:
                props = feature.get('properties', {})
                facility_type = props.get('Facility', 'Unknown')
                stats['facility_types'][facility_type] = stats['facility_types'].get(facility_type, 0) + 1
            
            # Estimate households with seniors/PWD (since we only have combined field)
            stats['households_with_seniors'] = stats['vulnerable_households']
            stats['households_with_pwd'] = stats['vulnerable_households']
            
        except Exception as e:
            print(f"Error calculating statistics: {e}")
        
        return stats

# Initialize data manager
data_manager = DataManager()

# ===== BASIC ROUTES =====
@app.route('/')
def index():
    """Homepage"""
    return render_template('index.html')

@app.route('/map')
def map_view():
    """Interactive map page"""
    return render_template('map.html')

@app.route('/map-editor')
def map_editor():
    """Advanced map editor with GIS tools"""
    return render_template('map_editor.html')

@app.route('/dashboard')
def dashboard():
    """Data dashboard with comprehensive statistics"""
    geojson_data = data_manager.load_geojson_data()
    stats = data_manager.get_statistics(geojson_data)
    
    # Add some sample data for demonstration (remove in production)
    if stats['total_households'] == 0:
        stats.update({
            'total_households': 47,
            'total_residents': 215,
            'total_facilities': 5,
            'vulnerable_households': 18,
            'households_with_seniors': 15,
            'households_with_pwd': 12,
            'purok_distribution': {'1': 15, '2': 12, '3': 10, '4': 8, '5': 2}
        })
    
    return render_template('dashboard.html', stats=stats)

@app.route('/household-data')
def household_data():
    """Household data table view"""
    geojson_data = data_manager.load_geojson_data()
    households = []
    
    for feature in geojson_data['households']['features']:
        props = feature.get('properties', {})
        households.append({
            'household_id': props.get('id', 'N/A'),
            'head_of_household': props.get('Owner', 'N/A'),
            'num_residents': props.get('Residents', 0),
            'has_seniors_pwd': 'Yes' if props.get('senior/PWD') == 'YES' else 'No',
            'contact': props.get('Contact no', 'N/A'),
            'family_name': props.get('Family nm', 'N/A')
        })
    
    # Sort by household ID
    households.sort(key=lambda x: x['household_id'])
    
    return render_template('household_data.html', households=households)

@app.route('/about')
def about():
    """About page"""
    return render_template('about.html')

# ===== HOUSEHOLD CRUD OPERATIONS =====
@app.route('/add-household', methods=['GET', 'POST'])
def add_household():
    """Add new household data with real saving functionality"""
    if request.method == 'POST':
        try:
            # Get household ID and convert to integer
            household_id_str = request.form.get('household_id', '').strip()
            if not household_id_str:
                flash('Household ID is required', 'error')
                return render_template('add_household.html')
            
            # Extract numeric ID from CPL- format or use as-is
            if household_id_str.startswith('CPL-'):
                household_id = int(household_id_str.replace('CPL-', ''))
            else:
                household_id = int(household_id_str)
            
            # Get form data
            household_data = {
                'id': household_id,
                'Owner': request.form.get('head_of_household', '').strip(),
                'Residents': int(request.form.get('num_residents', 1)),
                'senior/PWD': 'YES' if request.form.get('has_seniors_pwd') == 'true' else 'NO',
                'Family nm': request.form.get('family_name', '').strip(),
                'Contact no': request.form.get('contact', '').strip()
            }
            
            # Get coordinates
            latitude = float(request.form.get('latitude', 12.2392))
            longitude = float(request.form.get('longitude', 125.3185))
            
            # Validate required fields
            if not household_data['Owner']:
                flash('Head of Household is required', 'error')
                return render_template('add_household.html')
            
            # Create geometry (using Point for new households)
            geometry = {
                'type': 'Point',
                'coordinates': [longitude, latitude]
            }
            
            # Add to GeoJSON
            success, message = data_manager.add_feature('households', household_data, geometry)
            
            if success:
                flash('Household added successfully!', 'success')
                return redirect(url_for('household_data'))
            else:
                flash(f'Error saving household: {message}', 'error')
                
        except ValueError as e:
            flash('Please check that numeric fields contain valid numbers', 'error')
        except Exception as e:
            flash(f'Error processing form: {str(e)}', 'error')
    
    # Load current households for ID generation
    geojson_data = data_manager.load_geojson_data()
    
    return render_template('add_household.html', households=geojson_data['households']['features'])

@app.route('/edit-household/<household_id>', methods=['GET', 'POST'])
def edit_household(household_id):
    """Edit existing household data"""
    if request.method == 'POST':
        try:
            # Get form data
            updated_data = {
                'Owner': request.form.get('head_of_household', '').strip(),
                'Residents': int(request.form.get('num_residents', 1)),
                'senior/PWD': 'YES' if request.form.get('has_seniors_pwd') == 'true' else 'NO',
                'Family nm': request.form.get('family_name', '').strip(),
                'Contact no': request.form.get('contact', '').strip(),
                'purok': request.form.get('purok', '')
            }
            
            # Get coordinates
            latitude = float(request.form.get('latitude', 12.2392))
            longitude = float(request.form.get('longitude', 125.3185))
            
            # Validate required fields
            if not updated_data['Owner']:
                flash('Head of Household is required', 'error')
                return render_template('edit_household.html', household_id=household_id)
            
            # Create geometry
            geometry = {
                'type': 'Point',
                'coordinates': [longitude, latitude]
            }
            
            # Update in GeoJSON
            success, message = data_manager.update_feature('households', household_id, updated_data, geometry)
            
            if success:
                flash('Household updated successfully!', 'success')
                return redirect(url_for('household_data'))
            else:
                flash(f'Error updating household: {message}', 'error')
                
        except ValueError as e:
            flash('Please check that numeric fields contain valid numbers', 'error')
        except Exception as e:
            flash(f'Error processing form: {str(e)}', 'error')
    
    # Load actual household data
    geojson_data = data_manager.load_geojson_data()
    household = None
    
    for feature in geojson_data['households']['features']:
        if str(feature['properties'].get('id')) == str(household_id):
            household = {
                'properties': feature['properties'],
                'geometry': feature['geometry']
            }
            break
    
    if not household:
        flash('Household not found', 'error')
        return redirect(url_for('household_data'))
    
    return render_template('edit_household.html', household=household)

@app.route('/delete-household/<household_id>', methods=['POST'])
def delete_household(household_id):
    """Delete household data"""
    try:
        success, message = data_manager.delete_feature('households', household_id)
        
        if success:
            flash('Household deleted successfully!', 'success')
        else:
            flash(f'Error deleting household: {message}', 'error')
            
    except Exception as e:
        flash(f'Error deleting household: {str(e)}', 'error')
    
    return redirect(url_for('household_data'))

# ===== COMPATIBILITY ROUTES =====
@app.route('/interactive-map')
def interactive_map():
    """Alternative map route for compatibility"""
    return redirect(url_for('map_view'))

@app.route('/add-household-page')
def add_household_page():
    """Alternative add household route"""
    return redirect(url_for('add_household'))

@app.route('/bulk-upload', methods=['GET', 'POST'])
def bulk_upload():
    """Bulk upload households via CSV"""
    if request.method == 'POST':
        if 'csv_file' not in request.files:
            flash('No file selected', 'error')
            return redirect(request.url)
        
        file = request.files['csv_file']
        if file.filename == '':
            flash('No file selected', 'error')
            return redirect(request.url)
        
        if file and file.filename.endswith('.csv'):
            flash('Bulk upload completed successfully! (Demo feature)', 'success')
            return redirect(url_for('household_data'))
        else:
            flash('Please upload a CSV file', 'error')
    
    return render_template('bulk_upload.html')

@app.route('/download-template')
def download_template():
    """Download CSV template for bulk upload"""
    template_content = """household_id,head_of_household,num_residents,has_seniors_pwd,contact,purok,latitude,longitude
CPL-001,Juan Dela Cruz,5,YES,09123456789,1,12.2392,125.3185
CPL-002,Maria Santos,4,NO,09198765432,1,12.2395,125.3188
CPL-003,Pedro Reyes,6,YES,09223344556,2,12.2389,125.3182"""
    
    return template_content, 200, {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename=household_template.csv'
    }

# ===== GIS EDITING API ROUTES =====
@app.route('/api/update-feature', methods=['POST'])
def api_update_feature():
    """API endpoint to update feature properties and geometry"""
    try:
        data = request.get_json()
        layer_name = data.get('layer')
        feature_id = data.get('feature_id')
        properties = data.get('properties', {})
        geometry = data.get('geometry')
        
        success, message = data_manager.update_feature(layer_name, feature_id, properties, geometry)
        
        if success:
            return jsonify({'success': True, 'message': message})
        else:
            return jsonify({'success': False, 'message': message}), 400
            
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/delete-feature', methods=['POST'])
def api_delete_feature():
    """API endpoint to delete a feature"""
    try:
        data = request.get_json()
        layer_name = data.get('layer')
        feature_id = data.get('feature_id')
        
        success, message = data_manager.delete_feature(layer_name, feature_id)
        
        if success:
            return jsonify({'success': True, 'message': message})
        else:
            return jsonify({'success': False, 'message': message}), 400
            
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/add-feature', methods=['POST'])
def api_add_feature():
    """API endpoint to add a new feature"""
    try:
        data = request.get_json()
        layer_name = data.get('layer')
        properties = data.get('properties', {})
        geometry = data.get('geometry')
        
        # Generate new ID if not provided
        if 'id' not in properties:
            geojson_data = data_manager.load_geojson_data()
            existing_features = geojson_data.get(layer_name, {}).get('features', [])
            existing_ids = [
                int(f['properties'].get('id', 0)) 
                for f in existing_features 
                if f['properties'].get('id') and str(f['properties'].get('id')).isdigit()
            ]
            new_id = max(existing_ids) + 1 if existing_ids else 1
            properties['id'] = new_id
        
        success, message = data_manager.add_feature(layer_name, properties, geometry)
        
        if success:
            return jsonify({'success': True, 'message': message, 'feature_id': properties['id']})
        else:
            return jsonify({'success': False, 'message': message}), 400
            
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/get-feature/<layer_name>/<feature_id>')
def api_get_feature(layer_name, feature_id):
    """API endpoint to get a specific feature"""
    try:
        geojson_data = data_manager.load_geojson_data()
        layer_data = geojson_data.get(layer_name)
        
        if not layer_data:
            return jsonify({'success': False, 'message': f'Layer {layer_name} not found'}), 404
        
        for feature in layer_data['features']:
            if str(feature['properties'].get('id')) == str(feature_id):
                return jsonify({'success': True, 'feature': feature})
        
        return jsonify({'success': False, 'message': 'Feature not found'}), 404
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

# ===== DATA API ROUTES =====
@app.route('/api/households')
def get_households():
    """API endpoint for households GeoJSON"""
    geojson_data = data_manager.load_geojson_data()
    return jsonify(geojson_data['households'])

@app.route('/api/facilities')
def get_facilities():
    """API endpoint for facilities GeoJSON"""
    geojson_data = data_manager.load_geojson_data()
    return jsonify(geojson_data['facilities'])

@app.route('/api/roads')
def get_roads():
    """API endpoint for roads GeoJSON"""
    geojson_data = data_manager.load_geojson_data()
    return jsonify(geojson_data['roads'])

@app.route('/api/boundary')
def get_boundary():
    """API endpoint for boundary GeoJSON"""
    geojson_data = data_manager.load_geojson_data()
    return jsonify(geojson_data['boundary'])

@app.route('/api/statistics')
def get_statistics():
    """API endpoint for statistics"""
    geojson_data = data_manager.load_geojson_data()
    stats = data_manager.get_statistics(geojson_data)
    return jsonify(stats)

@app.route('/api/debug-data')
def debug_data():
    """Debug endpoint to check what data is being loaded"""
    geojson_data = data_manager.load_geojson_data()
    
    debug_info = {
        'households_count': len(geojson_data['households']['features']),
        'facilities_count': len(geojson_data['facilities']['features']),
        'roads_count': len(geojson_data['roads']['features']),
        'boundary_count': len(geojson_data['boundary']['features']),
        'data_directory': app.config['DATA_DIR'],
        'files_in_directory': os.listdir(app.config['DATA_DIR']) if os.path.exists(app.config['DATA_DIR']) else []
    }
    
    return jsonify(debug_info)

# ===== ERROR HANDLERS =====
@app.errorhandler(404)
def not_found(error):
    return render_template('404.html'), 404

@app.errorhandler(500)
def internal_error(error):
    return render_template('500.html'), 500

# ===== REQUEST HANDLERS =====
@app.before_request
def before_request():
    """Set up before each request"""
    pass

@app.after_request
def after_request(response):
    """Set up after each request"""
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    return response

# ===== APPLICATION STARTUP =====
if __name__ == '__main__':
    print("🚀 Starting Barangay Cagpile Information Mapping System...")
    print(f"📁 Data directory: {app.config['DATA_DIR']}")
    print(f"🌐 Access the application at: http://{app.config['HOST']}:{app.config['PORT']}")
    print("🎯 Advanced GIS Editor: http://localhost:5000/map-editor")
    
    # Check if data files exist and load them
    data_manager = DataManager()
    geojson_data = data_manager.load_geojson_data()
    
    print(f"🏠 Loaded {len(geojson_data['households']['features'])} households")
    print(f"🏢 Loaded {len(geojson_data['facilities']['features'])} facilities")
    print(f"🛣️ Loaded {len(geojson_data['roads']['features'])} roads")
    print(f"🗺️ Loaded {len(geojson_data['boundary']['features'])} boundary features")
    
    app.run(debug=app.config['DEBUG'], 
            host=app.config['HOST'], 
            port=app.config['PORT'])