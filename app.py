from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import sqlite3
from datetime import datetime
import os

app = Flask(__name__)

# CONFIGURACIÓN CRÍTICA DE CORS - Permitir todos los orígenes
CORS(app, 
     resources={r"/*": {
         "origins": "*",
         "methods": ["GET", "POST", "DELETE", "OPTIONS"],
         "allow_headers": ["Content-Type", "Accept"],
         "supports_credentials": False
     }})

# Agregar headers CORS manualmente también
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

# Nombre de la base de datos
DB_NAME = 'vehiculos.db'

def init_db():
    """Inicializa la base de datos y crea la tabla si no existe"""
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS vehiculos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            plate TEXT NOT NULL UNIQUE,
            ownerName TEXT NOT NULL,
            ownerPhone TEXT NOT NULL,
            carModel TEXT NOT NULL,
            carYear TEXT NOT NULL,
            ownerPhoto TEXT NOT NULL,
            carPhoto TEXT NOT NULL,
            registrationDate TEXT NOT NULL
        )
    ''')
    
    conn.commit()
    conn.close()
    print("✅ Base de datos inicializada")

# Inicializar la base de datos tan pronto como se cargue el script
init_db()

# ============================================
# API ENDPOINTS
# ============================================
@app.route('/')
def root():
    """Raíz de la API que devuelve un array vacío"""
    return jsonify([]), 200  # Devuelve un array vacío para la conexión

@app.route('/vehiculos', methods=['GET'])
def get_vehiculos():
    """Obtener todos los vehículos"""
    try:
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM vehiculos ORDER BY id DESC')
        rows = cursor.fetchall()
        
        vehiculos = []
        for row in rows:
            vehiculos.append({
                'id': row['id'],
                'plate': row['plate'],
                'ownerName': row['ownerName'],
                'ownerPhone': row['ownerPhone'],
                'carModel': row['carModel'],
                'carYear': row['carYear'],
                'ownerPhoto': row['ownerPhoto'],
                'carPhoto': row['carPhoto'],
                'registrationDate': row['registrationDate']
            })
        
        conn.close()
        return jsonify(vehiculos), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/vehiculos', methods=['POST'])
def add_vehiculo():
    """Agregar un nuevo vehículo"""
    try:
        data = request.get_json()
        
        # Validar datos requeridos
        required_fields = ['plate', 'ownerName', 'ownerPhone', 'carModel', 'carYear', 'ownerPhoto', 'carPhoto']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Falta el campo {field}'}), 400
        
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        
        # Agregar fecha de registro
        registration_date = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        cursor.execute('''
            INSERT INTO vehiculos (plate, ownerName, ownerPhone, carModel, carYear, ownerPhoto, carPhoto, registrationDate)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            data['plate'].upper(),
            data['ownerName'],
            data['ownerPhone'],
            data['carModel'],
            data['carYear'],
            data['ownerPhoto'],
            data['carPhoto'],
            registration_date
        ))
        
        conn.commit()
        vehicle_id = cursor.lastrowid
        conn.close()
        
        return jsonify({
            'message': 'Vehículo registrado exitosamente',
            'id': vehicle_id,
            'registrationDate': registration_date
        }), 201
    
    except sqlite3.IntegrityError:
        return jsonify({'error': 'La placa ya está registrada'}), 409
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/vehiculos/<string:plate>', methods=['GET'])
def get_vehiculo_by_plate(plate):
    """Buscar un vehículo por placa"""
    try:
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Limpiar la placa para búsqueda
        clean_plate = plate.upper().replace('-', '').replace(' ', '')
        
        cursor.execute('''
            SELECT * FROM vehiculos 
            WHERE REPLACE(REPLACE(UPPER(plate), '-', ''), ' ', '') = ?
        ''', (clean_plate,))
        
        row = cursor.fetchone()
        conn.close()
        
        if row:
            vehiculo = {
                'id': row['id'],
                'plate': row['plate'],
                'ownerName': row['ownerName'],
                'ownerPhone': row['ownerPhone'],
                'carModel': row['carModel'],
                'carYear': row['carYear'],
                'ownerPhoto': row['ownerPhoto'],
                'carPhoto': row['carPhoto'],
                'registrationDate': row['registrationDate']
            }
            return jsonify(vehiculo), 200
        else:
            return jsonify({'error': 'Vehículo no encontrado'}), 404
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/vehiculos/<int:id>', methods=['DELETE'])
def delete_vehiculo(id):
    """Eliminar un vehículo por ID"""
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        
        cursor.execute('DELETE FROM vehiculos WHERE id = ?', (id,))
        
        if cursor.rowcount == 0:
            conn.close()
            return jsonify({'error': 'Vehículo no encontrado'}), 404
        
        conn.commit()
        conn.close()
        
        return jsonify({'message': 'Vehículo eliminado exitosamente'}), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/stats', methods=['GET'])
def get_stats():
    """Obtener estadísticas de la base de datos"""
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        
        cursor.execute('SELECT COUNT(*) FROM vehiculos')
        total = cursor.fetchone()[0]
        
        cursor.execute('SELECT carYear, COUNT(*) as count FROM vehiculos GROUP BY carYear ORDER BY count DESC LIMIT 5')
        years = cursor.fetchall()
        
        conn.close()
        
        return jsonify({
            'totalVehiculos': total,
            'yearStats': [{'year': y[0], 'count': y[1]} for y in years]
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 10000))
    print("=" * 60)
    print("🚀 SERVIDOR INICIADO EN RENDER")
    print("=" * 60)
    print(f"🌐 Puerto: {port}")
    print("📊 Base de datos: vehiculos.db")
    print("=" * 60)
    app.run(host='0.0.0.0', port=port, debug=False)
