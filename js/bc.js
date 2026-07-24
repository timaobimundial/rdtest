// Variável global para armazenar os marcadores dos estimados
window.estimadosMarkers = [];

// Função para limpar os marcadores de estimado da tela
function limparEstimadosAtuais() {
    if (window.estimadosMarkers && window.aircraftMap) {
        window.estimadosMarkers.forEach(m => window.aircraftMap.removeLayer(m));
    }
    window.estimadosMarkers = [];
}

const polygonCoordinates = [
    [-20.582222, -48.596667],
    [-20.553611, -48.028056],
    [-20.543611, -47.856111],
    [-20.583611, -47.382500],
    [-20.210000, -46.985556],
    [-19.674167, -46.943611],
    [-19.561111, -46.964722],
    [-19.155556, -47.148889],
    [-19.312778, -48.092778],
    [-19.375000, -48.524167],
    [-19.425000, -48.906111],
    [-19.980278, -48.892500]
];

const sbur = [-47.966111111111, -19.764722222222];

function isPointInPolygon(point, polygon) {
    const pt = turf.point(point);
    const poly = turf.polygon([polygon]);
    return turf.booleanPointInPolygon(pt, poly);
}

function processAircraftData(data) {
    const tableBody = document.getElementById('resultado-table-body');
    tableBody.innerHTML = '';

    const validStates = data.states.filter(state => {
        const longitude = state[5];
        const latitude = state[6];
        const baroAltitude = state[7];

        if (longitude === null || latitude === null || baroAltitude === null) {
            return false;
        }

        const point = [longitude, latitude];
        const insidePolygon = isPointInPolygon(point, polygonCoordinates);
        const altitudeInFeet = baroAltitude * 3.28084;
        const FL = altitudeInFeet / 100;

        return insidePolygon && FL < 195;
    });

    if (validStates.length === 0) {
        document.getElementById('resultado-table').style.display = 'none';
        return;
    }

    document.getElementById('resultado-table').style.display = 'table';

    validStates.forEach(state => {
        const callsign = state[1].trim();
        const longitude = state[5];
        const latitude = state[6];
        const baroAltitude = state[7];
        const velocity = state[9];
        const trueTrack = state[10];

        const point = [longitude, latitude];
        const altitudeInFeet = baroAltitude * 3.28084;
        const FL = altitudeInFeet / 100;
        const FLFormatado = 'F' + Math.round(FL).toString().padStart(3, '0');

        let speedKts = '---';
        if (velocity !== null) {
            speedKts = (velocity * 1.94384).toFixed(0);
        }

        let rumoMagnetic = '---';
        if (trueTrack !== null) {
            rumoMagnetic = String(Math.ceil((trueTrack + 22) % 360)).padStart(3, '0');
        }

        const point1 = turf.point(sbur);
        const point2 = turf.point([longitude, latitude]);

        const distanceNM = turf.distance(point1, point2, { units: 'kilometers' }) * 0.539957;
        const bearing = (turf.bearing(point1, point2) + 360) % 360;
        const magneticBearing = (bearing + 22) % 360;

        const row = document.createElement('tr');
        row.style.cursor = 'pointer';

        const aircraft = {
            identifier: callsign,
            latitude: latitude,
            longitude: longitude,
            radial: `URB${magneticBearing.toFixed(0)}°`,
            distanciaNM: distanceNM,
            fl: FLFormatado,
            velocidade: speedKts,
            rumoMagnetic: rumoMagnetic
        };

        row.onclick = () => abrirMapaAeronave(aircraft);

        const cellIdent = document.createElement('td');
        cellIdent.textContent = callsign;
        row.appendChild(cellIdent);

        const cellPos = document.createElement('td');
        cellPos.textContent = `URB${magneticBearing.toFixed(0)}° ${distanceNM.toFixed(0)}NM`;
        row.appendChild(cellPos);

        const cellFL = document.createElement('td');
        cellFL.textContent = FLFormatado;
        row.appendChild(cellFL);

        const cellSpeed = document.createElement('td');
        cellSpeed.textContent = speedKts !== '---' ? `${speedKts}kt` : '---';
        row.appendChild(cellSpeed);

        const cellRumo = document.createElement('td');
        cellRumo.textContent = rumoMagnetic !== '---' ? `${rumoMagnetic}°` : '---';
        row.appendChild(cellRumo);

        tableBody.appendChild(row);
    });
}

function fetchDataBC() {
    fetch('https://opensky-network.org/api/states/all?lamin=-20.582222&lomin=-48.906111&lamax=-19.155556&lomax=-46.943611')
        .then(response => response.json())
        .then(data => {
            document.getElementById('mensagem-carregamento').style.display = 'none';
            processAircraftData(data);
        })
        .catch(error => {
            console.error('Erro ao buscar dados:', error);
            document.getElementById('mensagem-carregamento').style.display = 'none';
        });
}

document.addEventListener('DOMContentLoaded', () => {
    fetchDataBC();
    setInterval(fetchDataBC, 10000);
});

// =========================================================
// FUNÇÃO DE ABERTURA E RENDERIZAÇÃO DO MAPA DA AERONAVE
// =========================================================
function abrirMapaAeronave(aircraft) {
    if (!window.aeronavesExibidas) window.aeronavesExibidas = [];
    if (!window.linhasSBUR) window.linhasSBUR = [];
    if (!window.linhasRumo) window.linhasRumo = [];
    if (!window.estimadosMarkers) window.estimadosMarkers = [];
    
    const jaExiste = window.aeronavesExibidas.some(ac => ac.identifier === aircraft.identifier);
    if (!jaExiste) {
        window.aeronavesExibidas.push(aircraft);
    }

    const mapDiv = document.getElementById('map');
    const metarContainer = document.querySelector('.container_metar');

    if (metarContainer) {
        const rect = metarContainer.getBoundingClientRect();
        mapDiv.style.display = 'block';
        mapDiv.style.position = 'fixed';
        mapDiv.style.top = rect.top + 'px';
        mapDiv.style.left = rect.left + 'px';
        mapDiv.style.width = rect.width + 'px';
        mapDiv.style.height = rect.height + 'px';
        mapDiv.style.margin = '0';
        mapDiv.style.padding = '0';
        mapDiv.style.zIndex = '9999';
    }

    if (!window.aircraftMap) {
        window.aircraftMap = L.map('map', {
            scrollWheelZoom: true
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(window.aircraftMap);

        const polygonLatLng = polygonCoordinates.map(c => [c[1], c[0]]);

        L.polygon(polygonLatLng, {
            color: 'gray',
            fillColor: 'lightgray',
            fillOpacity: 0.5,
            weight: 0.5
        }).addTo(window.aircraftMap);
    }

    if (aircraft.marker && window.aircraftMap.hasLayer(aircraft.marker)) {
        window.aircraftMap.removeLayer(aircraft.marker);
    }

    let nomeImagemIcone = 'arq/planebcmap.png';
    let rotation = 0;

    if (aircraft.rumoMagnetic === '---') {
        nomeImagemIcone = 'arq/int.png';
    } else {
        rotation = parseInt(aircraft.rumoMagnetic) - 22;
    }

    const planeIcon = L.divIcon({
        className: 'plane-div-icon',
        html: `<img src="${nomeImagemIcone}" style="transform: rotate(${rotation}deg); transform-origin:center;">`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
    });

    const planeMarker = L.marker(
        [aircraft.latitude, aircraft.longitude],
        { icon: planeIcon }
    ).addTo(window.aircraftMap);

    aircraft.marker = planeMarker;

    planeMarker.bindTooltip(
        `<div style="text-align:center">
            ${aircraft.identifier}<br>
            ${aircraft.radial.replace('URB', '').replace('°', '')}° ${aircraft.distanciaNM.toFixed(0)}NM
        </div>`,
        {
            permanent: true,
            direction: "top",
            offset: [0, -15],
            className: "tooltip-aeronave"
        }
    );

    // =========================================================
    // CLIQUE NO ÍCONE DO AVIÃO PARA ABRIR O INPUT FLUTUANTE
    // =========================================================
    planeMarker.on('click', function(e) {
        L.DomEvent.stopPropagation(e);

        if (aircraft.inputMarker) {
            window.aircraftMap.removeLayer(aircraft.inputMarker);
            aircraft.inputMarker = null;
            limparEstimadosAtuais();
            return;
        }

        const inputHtml = `<input type="text" class="input-estimado-plane" placeholder="Ex: ISRIK" id="input_est_${aircraft.identifier}">`;
        const inputIcon = L.divIcon({
            className: 'custom-input-container',
            html: inputHtml,
            iconSize: [70, 25],
            iconAnchor: [35, -10]
        });

        aircraft.inputMarker = L.marker([aircraft.latitude, aircraft.longitude], { icon: inputIcon }).addTo(window.aircraftMap);

        setTimeout(() => {
            const elInput = document.getElementById(`input_est_${aircraft.identifier}`);
            if (elInput) {
                elInput.focus();
                
                // Atualização em tempo real conforme digita/apaga
                elInput.addEventListener('input', function() {
                    processarComandoEstimado(aircraft, elInput.value.trim().toUpperCase());
                });

                elInput.addEventListener('keydown', function(event) {
                    if (event.key === 'Enter') {
                        elInput.blur();
                    }
                });
            }
        }, 100);
    });

    if (!window.markerSBUR || !window.aircraftMap.hasLayer(window.markerSBUR)) {
        window.markerSBUR = L.marker([sbur[1], sbur[0]]).addTo(window.aircraftMap);
    }

    const bounds = L.latLngBounds([[sbur[1], sbur[0]]]);
    window.aeronavesExibidas.forEach(ac => {
        bounds.extend([ac.latitude, ac.longitude]);
    });

    window.linhasSBUR.forEach(linha => window.aircraftMap.removeLayer(linha));
    window.linhasSBUR = [];
    window.linhasRumo.forEach(linha => window.aircraftMap.removeLayer(linha));
    window.linhasRumo = [];

    window.aeronavesExibidas.forEach(ac => {
        const linhaSBUR = L.polyline(
            [
                [sbur[1], sbur[0]],
                [ac.latitude, ac.longitude]
            ],
            { color: '#7fb0d4', weight: 3 }
        ).addTo(window.aircraftMap);

        window.linhasSBUR.push(linhaSBUR);
    });

    window.aircraftMap.fitBounds(bounds, {
        paddingTopLeft: [90, 90],
        paddingBottomRight: [50, 50]
    });

    setTimeout(() => {
        window.aircraftMap.invalidateSize();
    }, 100);
}

// =========================================================
// LÓGICA DE PROCESSAMENTO E BUSCA DOS ESTIMADOS
// =========================================================
async function processarComandoEstimado(aircraft, comando) {
    limparEstimadosAtuais();

    if (!comando) return;

    let isTraves = false;
    let termo = comando;

    if (comando.startsWith('T ')) {
        isTraves = true;
        termo = comando.substring(2).trim();
    }

    if (!termo) return;

    let destLat = null, destLng = null, nomePonto = termo;

    // 1. Caso SBUR local
    if (termo === 'SBUR') {
        destLat = sbur[1];
        destLng = sbur[0];
    } 
    // 2. Busca nos FIXES de 5 letras (waypoint.csv)
    else if (termo.length === 5 && typeof fixes !== 'undefined' && fixes.length > 0) {
        const fixEncontrado = fixes.find(f => f.ident === termo);
        if (fixEncontrado) {
            destLat = fixEncontrado.lat;
            destLng = fixEncontrado.lng;
        }
    } 
    // 3. Busca em Aeródromos de 4 letras (API AISWEB)
    else if (termo.length === 4) {
        try {
            const apiUrl = `https://aisweb.decea.mil.br/api/?apiKey=1505393075&apiPass=1f301b84-0a7c-11ed-9f5b-0050569ac2e1&area=rotaer&icaoCode=${termo}`;
            const response = await fetch(apiUrl);
            const xmlText = await response.text();
            
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, "text/xml");

            destLat = parseFloat(
                xmlDoc.querySelector("lat")?.textContent ||
                xmlDoc.querySelector("latRotaer")?.textContent
            );
            destLng = parseFloat(
                xmlDoc.querySelector("lng")?.textContent ||
                xmlDoc.querySelector("lngRotaer")?.textContent
            );

            if (isNaN(destLat) || isNaN(destLng)) {
                destLat = null;
                destLng = null;
            }
        } catch (e) {
            destLat = null;
            destLng = null;
        }
    }

    if (destLat === null || destLng === null) return;

    const gs = parseFloat(aircraft.velocidade);
    if (isNaN(gs) || gs <= 0) return;

    const pontoAviao = turf.point([aircraft.longitude, aircraft.latitude]);
    let distNM = 0;

    if (!isTraves) {
        // CÁLCULO DIRETO
        const pontoDestino = turf.point([destLng, destLat]);
        const distKM = turf.distance(pontoAviao, pontoDestino, { units: 'kilometers' });
        distNM = distKM * 0.539957;

        desenharPontoEstimado(destLat, destLng, `${nomePonto}`, distNM, gs);

    } else {
        // CÁLCULO DE TRAVÉS (90°)
        const rumoMag = parseInt(aircraft.rumoMagnetic);
        if (isNaN(rumoMag)) return;

        const rumoVerdadeiro = (rumoMag - 22 + 360) % 360;
        
        const pontoProjetado = turf.destination(pontoAviao, 1000, rumoVerdadeiro, { units: 'kilometers' });
        const linhaVoo = turf.lineString([[aircraft.longitude, aircraft.latitude], pontoProjetado.geometry.coordinates]);
        
        const pontoRef = turf.point([destLng, destLat]);
        const pontoTraves = turf.nearestPointOnLine(linhaVoo, pontoRef);

        const lngFinal = pontoTraves.geometry.coordinates[0];
        const latFinal = pontoTraves.geometry.coordinates[1];

        const distKM = turf.distance(pontoAviao, pontoTraves, { units: 'kilometers' });
        distNM = distKM * 0.539957;

        desenharSimplesPonto(destLat, destLng);
        desenharPontoEstimado(latFinal, lngFinal, `TRAVÉS ${nomePonto}`, distNM, gs);
    }
}

function desenharSimplesPonto(lat, lng) {
    const iconPonto = L.divIcon({
        className: 'ponto-marcador-icon',
        iconSize: [8, 8],
        iconAnchor: [4, 4]
    });
    const m = L.marker([lat, lng], { icon: iconPonto }).addTo(window.aircraftMap);
    window.estimadosMarkers.push(m);
}

function desenharPontoEstimado(lat, lng, titulo, distNM, gs) {
    const tempoHoras = distNM / gs;
    const tempoMinutosTotal = Math.round(tempoHoras * 60);

    const agora = new Date();
    agora.setMinutes(agora.getMinutes() + tempoMinutosTotal);

    const horasStr = agora.getHours().toString().padStart(2, '0');
    const minStr = agora.getMinutes().toString().padStart(2, '0');
    const minDiferencaStr = tempoMinutosTotal.toString().padStart(2, '0');

    const textoEtiqueta = `• ${titulo} +${minDiferencaStr}' ${horasStr}:${minStr}`;

    const iconPonto = L.divIcon({
        className: 'ponto-marcador-icon',
        iconSize: [8, 8],
        iconAnchor: [4, 4]
    });

    const markerPonto = L.marker([lat, lng], { icon: iconPonto }).addTo(window.aircraftMap);

    markerPonto.bindTooltip(textoEtiqueta, {
        permanent: true,
        direction: "right",
        offset: [10, 0],
        className: "tooltip-estimado-resultado"
    });

    window.estimadosMarkers.push(markerPonto);
}
