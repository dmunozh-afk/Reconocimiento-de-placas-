// ⚠️ URL de tu backend en Render
const API_URL = 'https://reconocimiento-de-placas-5.onrender.com';

let stream = null;
let isProcessing = false;
let uploadedImage = null;
let autoScanInterval = null;
let lastDetectedPlate = null;
let isConnected = false;

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');4
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusDiv = document.getElementById('status');
const resultContainer = document.getElementById('resultContainer');
const captureMethod = document.getElementById('captureMethod');
const cameraMode = document.getElementById('cameraMode');
const uploadMode = document.getElementById('uploadMode');
const manualMode = document.getElementById('manualMode');
const plateImage = document.getElementById('plateImage');
const uploadPreview = document.getElementById('uploadPreview');
const recognizeBtn = document.getElementById('recognizeBtn');
const manualPlate = document.getElementById('manualPlate');
const searchBtn = document.getElementById('searchBtn');
const scanIndicator = document.getElementById('scanIndicator');
const connectionBadge = document.getElementById('connectionBadge');

// ============================================
// FUNCIONES DE CONEXIÓN
// ============================================
async function checkConnection() {
    try {
        const response = await fetch(`${API_URL}/vehiculos`, { 
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        updateConnectionStatus(true);
        return true;
    } catch (error) {
        updateConnectionStatus(false);
        return false;
    }
}

function updateConnectionStatus(connected) {
    isConnected = connected;
    const badge = connectionBadge;
    
    if (connected) {
        badge.className = 'connection-badge connected';
        badge.innerHTML = '<span class="dot"></span><span>Conectado a Base de Datos</span>';
    } else {
        badge.className = 'connection-badge disconnected';
        badge.innerHTML = '<span class="dot"></span><span>Sin Conexión</span>';
    }
}

// ============================================
// FUNCIONES DE API
// ============================================
async function loadVehiclesFromAPI() {
    try {
        const response = await fetch(`${API_URL}/vehiculos`);
        if (response.ok) {
            const vehicles = await response.json();
            console.log('✅ Datos cargados desde API:', vehicles.length, 'vehículos');
            return vehicles;
        }
    } catch (error) {
        console.log('❌ Error al cargar datos:', error);
        return [];
    }
}

async function addVehicleToAPI(vehicle) {
    try {
        console.log('Enviando a:', `${API_URL}/vehiculos`);
        console.log('Datos del vehículo:', {
            ...vehicle,
            ownerPhoto: vehicle.ownerPhoto ? 'base64...' : 'sin foto',
            carPhoto: vehicle.carPhoto ? 'base64...' : 'sin foto'
        });
        
        const response = await fetch(`${API_URL}/vehiculos`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(vehicle)
        });
        
        console.log('Respuesta status:', response.status);
        console.log('Respuesta headers:', response.headers);
        
        // Leer el texto de la respuesta primero
        const responseText = await response.text();
        console.log('Respuesta texto:', responseText.substring(0, 200));
        
        // Intentar parsear como JSON
        let result;
        try {
            result = JSON.parse(responseText);
        } catch (e) {
            throw new Error(`El servidor respondió con HTML en lugar de JSON. Verifica que la URL del API sea correcta: ${API_URL}`);
        }
        
        if (response.ok) {
            console.log('✅ Vehículo guardado:', result);
            return result;
        } else {
            throw new Error(result.error || 'Error al guardar');
        }
    } catch (error) {
        console.error('❌ Error completo:', error);
        throw error;
    }
}

async function deleteVehicleFromAPI(id) {
    try {
        const response = await fetch(`${API_URL}/vehiculos`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            console.log('✅ Vehículo eliminado de API');
            return true;
        } else {
            throw new Error('Error al eliminar');
        }
    } catch (error) {
        console.error('❌ Error al eliminar:', error);
        throw error;
    }
}

async function searchVehicleInAPI(plate) {
    try {
        const response = await fetch(`${API_URL}/vehiculos`);
        if (response.ok) {
            const vehicle = await response.json();
            return vehicle;
        } else if (response.status === 404) {
            return null;
        } else {
            throw new Error('Error en la búsqueda');
        }
    } catch (error) {
        console.error('❌ Error en búsqueda:', error);
        return null;
    }
}

// ============================================
// EVENT LISTENERS
// ============================================
captureMethod.addEventListener('change', (e) => {
    stopAutoScan();
    cameraMode.style.display = 'none';
    uploadMode.style.display = 'none';
    manualMode.style.display = 'none';
    resultContainer.innerHTML = '';
    statusDiv.style.display = 'none';
    
    if (e.target.value === 'camera') {
        cameraMode.style.display = 'block';
    } else if (e.target.value === 'upload') {
        uploadMode.style.display = 'block';
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            video.srcObject = null;
        }
        startBtn.disabled = false;
        stopBtn.disabled = true;
    } else if (e.target.value === 'manual') {
        manualMode.style.display = 'block';
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            video.srcObject = null;
        }
        startBtn.disabled = false;
        stopBtn.disabled = true;
    }
});

searchBtn.addEventListener('click', async () => {
    const plate = manualPlate.value.trim();
    if (plate.length >= 3) {
        showStatus(`🔍 Buscando placa: ${plate}`, 'processing');
        const vehicle = await searchVehicleInAPI(plate);
        if (vehicle) {
            showStatus(`✅ Vehículo encontrado`, 'success');
            displayResult(vehicle);
        } else {
            showStatus('❌ Vehículo no encontrado', 'error');
            resultContainer.innerHTML = `
                <div class="result-card" style="background: #fee2e2; border-color: #fecaca;">
                    <h3 style="text-align: center; color: #dc2626;">⚠️ Vehículo No Encontrado</h3>
                    <p style="text-align: center; margin-top: 10px; color: #374151;">
                        La placa <strong>${plate}</strong> no está registrada en el sistema.
                    </p>
                </div>
            `;
        }
    } else {
        showStatus('Por favor ingresa al menos 3 caracteres', 'error');
    }
});

manualPlate.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        searchBtn.click();
    }
});

plateImage.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            uploadedImage = new Image();
            uploadedImage.onload = () => {
                uploadPreview.src = event.target.result;
                uploadPreview.style.display = 'block';
                recognizeBtn.disabled = false;
            };
            uploadedImage.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
});

recognizeBtn.addEventListener('click', async () => {
    if (!uploadedImage || isProcessing) return;
    
    isProcessing = true;
    recognizeBtn.disabled = true;
    
    await processImage(uploadedImage);
    
    isProcessing = false;
    recognizeBtn.disabled = false;
});

startBtn.addEventListener('click', async () => {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
        });
        video.srcObject = stream;
        startBtn.disabled = true;
        stopBtn.disabled = false;
        scanIndicator.style.display = 'flex';
        showStatus('✅ Escaneo automático iniciado', 'success');
        
        startAutoScan();
    } catch (error) {
        showStatus('❌ Error al acceder a la cámara', 'error');
    }
});

stopBtn.addEventListener('click', () => {
    stopAutoScan();
});

function startAutoScan() {
    autoScanInterval = setInterval(async () => {
        if (!isProcessing && stream) {
            await captureAndRecognize();
        }
    }, 4000);
}

function stopAutoScan() {
    if (autoScanInterval) {
        clearInterval(autoScanInterval);
        autoScanInterval = null;
    }
    
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        video.srcObject = null;
        startBtn.disabled = false;
        stopBtn.disabled = true;
        scanIndicator.style.display = 'none';
        showStatus('⏸️ Escaneo detenido', 'success');
    }
}

async function captureAndRecognize() {
    if (isProcessing) return;
    
    isProcessing = true;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < imageData.data.length; i += 4) {
        const avg = (imageData.data[i] + imageData.data[i + 1] + imageData.data[i + 2]) / 3;
        const contrasted = avg > 128 ? 255 : 0;
        imageData.data[i] = contrasted;
        imageData.data[i + 1] = contrasted;
        imageData.data[i + 2] = contrasted;
    }
    ctx.putImageData(imageData, 0, 0);
    
    showStatus('🔍 Analizando placa...', 'processing');
    
    try {
        const result = await Tesseract.recognize(canvas, 'eng', {
            logger: m => {
                if (m.status === 'recognizing text') {
                    showStatus(`🔍 Escaneando: ${Math.round(m.progress * 100)}%`, 'processing');
                }
            },
            tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
        });

        const detectedText = result.data.text.trim();
        const possiblePlates = extractPlates(detectedText);
        
        if (possiblePlates.length > 0) {
            for (let plate of possiblePlates) {
                if (plate !== lastDetectedPlate) {
                    const vehicle = await searchVehicleInAPI(plate);
                    if (vehicle) {
                        lastDetectedPlate = plate;
                        showStatus(`✅ Placa detectada: ${plate}`, 'success');
                        displayResult(vehicle);
                        isProcessing = false;
                        return;
                    }
                }
            }
            showStatus(`🔍 Escaneando... (${possiblePlates[0]})`, 'processing');
        } else {
            showStatus('🔍 Buscando placa...', 'processing');
        }
    } catch (error) {
        console.error('Error en reconocimiento:', error);
    }
    
    isProcessing = false;
}

async function processImage(image) {
    canvas.width = image.width;
    canvas.height = image.height;
    
    ctx.drawImage(image, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    for (let i = 0; i < imageData.data.length; i += 4) {
        const avg = (imageData.data[i] + imageData.data[i + 1] + imageData.data[i + 2]) / 3;
        const contrasted = avg > 128 ? 255 : 0;
        imageData.data[i] = contrasted;
        imageData.data[i + 1] = contrasted;
        imageData.data[i + 2] = contrasted;
    }
    ctx.putImageData(imageData, 0, 0);
    
    showStatus('🔍 Analizando imagen...', 'processing');
    
    try {
        const result = await Tesseract.recognize(canvas, 'eng', {
            logger: m => {
                if (m.status === 'recognizing text') {
                    showStatus(`🔍 Reconociendo: ${Math.round(m.progress * 100)}%`, 'processing');
                }
            },
            tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
        });

        const detectedText = result.data.text.trim();
        const possiblePlates = extractPlates(detectedText);
        
        if (possiblePlates.length > 0) {
            for (let plate of possiblePlates) {
                const vehicle = await searchVehicleInAPI(plate);
                if (vehicle) {
                    showStatus(`✅ Placa detectada: ${plate}`, 'success');
                    displayResult(vehicle);
                    return;
                }
            }
            
            showStatus(`⚠️ Placas detectadas pero no registradas: ${possiblePlates.join(', ')}`, 'error');
            resultContainer.innerHTML = `
                <div class="result-card" style="background: #fee2e2; border-color: #fecaca;">
                    <h3 style="text-align: center; color: #dc2626;">⚠️ Placas No Registradas</h3>
                    <p style="text-align: center; margin-top: 10px; color: #374151;">
                        Placas detectadas: <strong>${possiblePlates.join(', ')}</strong><br>
                        Ninguna está registrada en el sistema.
                    </p>
                </div>
            `;
        } else {
            showStatus('❌ No se detectó una placa válida', 'error');
            resultContainer.innerHTML = '';
        }
    } catch (error) {
        showStatus('❌ Error al procesar la imagen', 'error');
        console.error(error);
    }
}

function extractPlates(text) {
    const plates = [];
    const cleaned = text.toUpperCase().replace(/[^A-Z0-9\s]/g, '');
    const words = cleaned.split(/\s+/);
    
    for (let word of words) {
        if (word.length >= 5 && word.length <= 8) {
            const hasLetters = /[A-Z]/.test(word);
            const hasNumbers = /[0-9]/.test(word);
            if (hasLetters && hasNumbers) {
                plates.push(word);
            }
        }
    }
    
    const noSpaces = cleaned.replace(/\s/g, '');
    if (noSpaces.length >= 5 && noSpaces.length <= 8) {
        const hasLetters = /[A-Z]/.test(noSpaces);
        const hasNumbers = /[0-9]/.test(noSpaces);
        if (hasLetters && hasNumbers && !plates.includes(noSpaces)) {
            plates.push(noSpaces);
        }
    }
    
    return plates;
}

function displayResult(vehicle) {
    const registrationDate = vehicle.registrationDate || 'No registrada';
    const currentDate = new Date().toLocaleDateString('es-CO');
    
    resultContainer.innerHTML = `
        <div class="result-card">
            <h3 style="text-align: center; margin-bottom: 25px; color: #059669;">✅ VEHÍCULO IDENTIFICADO</h3>
            <div class="result-grid">
                <div class="result-images">
                    <div>
                        <div class="image-label">👤 Propietario</div>
                        <img src="${vehicle.ownerPhoto}" alt="Propietario" class="result-img">
                    </div>
                    <div>
                        <div class="image-label">🚗 Vehículo</div>
                        <img src="${vehicle.carPhoto}" alt="Vehículo" class="result-img">
                    </div>
                </div>
                <div class="result-info">
                    <h3>Información del Vehículo</h3>
                    <div class="info-grid">
                        <div class="info-item">
                            <span class="info-label">🚗 Placa</span>
                            <span class="info-value">${vehicle.plate}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">🚙 Modelo</span>
                            <span class="info-value">${vehicle.carModel}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">📅 Año</span>
                            <span class="info-value">${vehicle.carYear}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">👤 Propietario</span>
                            <span class="info-value">${vehicle.ownerName}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">📞 Teléfono</span>
                            <span class="info-value">${vehicle.ownerPhone}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">🔢 ID Registro</span>
                            <span class="info-value">#${vehicle.id}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">📋 Fecha Registro</span>
                            <span class="info-value">${registrationDate}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">📆 Fecha Consulta</span>
                            <span class="info-value">${currentDate}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';
}

document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const ownerPhotoSrc = document.getElementById('ownerPreview').src;
    const carPhotoSrc = document.getElementById('carPreview').src;
    
    if (!ownerPhotoSrc || !carPhotoSrc || ownerPhotoSrc === '' || carPhotoSrc === '') {
        showStatus('❌ Por favor carga ambas fotos', 'error');
        return;
    }
    
    const vehicle = {
        plate: document.getElementById('plateText').value.toUpperCase().trim(),
        ownerName: document.getElementById('ownerName').value.trim(),
        ownerPhone: document.getElementById('ownerPhone').value.trim(),
        carModel: document.getElementById('carModel').value.trim(),
        carYear: document.getElementById('carYear').value.trim(),
        ownerPhoto: ownerPhotoSrc,
        carPhoto: carPhotoSrc
    };

    try {
        showStatus('💾 Guardando vehículo...', 'processing');
        const result = await addVehicleToAPI(vehicle);
        showStatus('✅ Vehículo registrado exitosamente', 'success');
        
        e.target.reset();
        document.getElementById('ownerPreview').style.display = 'none';
        document.getElementById('carPreview').style.display = 'none';
        
        await loadDatabase();
        
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 3000);
    } catch (error) {
        console.error('Error completo:', error);
        showStatus('❌ Error al registrar: ' + error.message, 'error');
    }
});

document.getElementById('ownerPhoto').addEventListener('change', (e) => {
    previewImage(e.target, 'ownerPreview');
});

document.getElementById('carPhoto').addEventListener('change', (e) => {
    previewImage(e.target, 'carPreview');
});

function previewImage(input, previewId) {
    const preview = document.getElementById(previewId);
    const file = input.files[0];
    
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            preview.src = e.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
}

async function loadDatabase() {
    try {
        const vehicles = await loadVehiclesFromAPI();
        const dbContent = document.getElementById('dbContent');
        
        if (!vehicles || vehicles.length === 0) {
            dbContent.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🚗</div>
                    <p>No hay vehículos registrados</p>
                </div>
            `;
            return;
        }

        let html = `
            <table class="db-table">
                <thead>
                    <tr>
                        <th>Placa</th>
                        <th>Propietario</th>
                        <th>Foto</th>
                        <th>Vehículo</th>
                        <th>Modelo</th>
                        <th>Año</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
        `;

        vehicles.forEach(v => {
            html += `
                <tr>
                    <td><strong>${v.plate}</strong></td>
                    <td>${v.ownerName}</td>
                    <td><img src="${v.ownerPhoto}" alt="Propietario"></td>
                    <td><img src="${v.carPhoto}" alt="Vehículo"></td>
                    <td>${v.carModel}</td>
                    <td>${v.carYear}</td>
                    <td>
                        <button class="action-btn delete-btn" onclick="deleteVehicle(${v.id})">
                            🗑️ Eliminar
                        </button>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        dbContent.innerHTML = html;
    } catch (error) {
        console.error('Error al cargar base de datos:', error);
        document.getElementById('dbContent').innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚠️</div>
                <p>Error al cargar vehículos</p>
            </div>
        `;
    }
}

// Función global para eliminar (necesaria para onclick en HTML dinámico)
window.deleteVehicle = async function(id) {
    if (confirm('¿Estás seguro de eliminar este vehículo?')) {
        try {
            await deleteVehicleFromAPI(id);
            await loadDatabase();
            showStatus('✅ Vehículo eliminado', 'success');
            setTimeout(() => {
                statusDiv.style.display = 'none';
            }, 3000);
        } catch (error) {
            showStatus('❌ Error al eliminar: ' + error.message, 'error');
        }
    }
}; // 👈  ESTE PUNTO Y COMA ES CLAVE

(async function init() {
    await checkConnection();
    await loadDatabase();
    setInterval(checkConnection, 30000);
})();


// Inicialización
(async function init() {
    await checkConnection();
    await loadDatabase();
    
    setInterval(checkConnection, 30000);
})();
