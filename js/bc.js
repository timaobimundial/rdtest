const sbur = [-47.966111, -19.764722];
const declinacaoSBUR = -22;

const resultadoTable = document.getElementById('resultado-table');
const resultadoTableBody = document.getElementById('resultado-table-body');
const resultadoContainer = document.getElementById('resultado-container');
const mensagemCarregamento = document.getElementById('mensagem-carregamento');
const imagemCarregamento = mensagemCarregamento.querySelector('img');

const API_URL = "https://rdtest-peach.vercel.app/api/bc";

// polígono SBUR
const polygonCoordinates = [
    [-48.596667, -20.576667],
    [-48.028056, -20.553611],
    [-47.856111, -20.543611],
    [-47.382500, -20.583611],
    [-46.985556, -20.209722],
    [-46.943611, -19.674167],
    [-46.964722, -19.561111],
    [-47.148889, -19.155556],
    [-48.092778, -19.312778],
    [-48.524167, -19.376111],
    [-48.906111, -19.425000],
    [-48.891944, -19.980278],
    [-48.596667, -20.576667]
];

const polygon = turf.polygon([polygonCoordinates]);

window.aircraftMap = null;
window.aeronavesExibidas = [];
window.linhasSBUR = [];
window.linhasRumo = [];

function abrirMapaAeronave(aircraft) {
    if (!window.aeronavesExibidas) window.aeronavesExibidas = [];
    if (!window.linhasSBUR) window.linhasSBUR = [];
    if (!window.linhasRumo) window.linhasRumo = [];
    
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

    const rotation = aircraft.rumoMagnetic !== '---' ? parseInt(aircraft.rumoMagnetic) - 22 : 0;

    const planeIcon = L.divIcon({
        className: 'plane-div-icon',
        html: `<img src="arq/planebcmap.png" style="transform: rotate(${rotation}deg); transform-origin:center;">`,
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

    if (!window.markerSBUR || !window.aircraftMap.hasLayer(window.markerSBUR)) {
        window.markerSBUR = L.marker([sbur[1], sbur[0]]).addTo(window.aircraftMap);
    }

    const bounds = L.latLngBounds([[sbur[1], sbur[0]]]);
    window.aeronavesExibidas.forEach(ac => {
        bounds.extend([ac.latitude, ac.longitude]);
    });

    window.linhasSBUR.forEach(linha => window.aircraftMap.removeLayer(linha));
    window.linhasSBUR = [];

    if (window.aeronavesExibidas.length === 1) {
        const linha = L.polyline(
            [
                [sbur[1], sbur[0]],
                [window.aeronavesExibidas[0].latitude, window.aeronavesExibidas[0].longitude]
            ],
            { color: '#7fb0d4' }
        ).addTo(window.aircraftMap);

        window.linhasSBUR.push(linha);
    } 

    window.linhasRumo.forEach(linha => window.aircraftMap.removeLayer(linha));
    window.linhasRumo = [];

    if (window.aeronavesExibidas.length >= 2) {
        window.aeronavesExibidas.forEach(ac => {
            const rumo = parseInt(ac.rumoMagnetic);
            if (isNaN(rumo)) return;

            const destino = turf.destination(
                turf.point([ac.longitude, ac.latitude]),
                500,
                rumo,
                { units: 'kilometers' }
            );

            const linha = L.polyline(
                [
                    [ac.latitude, ac.longitude],
                    [
                        destino.geometry.coordinates[1],
                        destino.geometry.coordinates[0]
                    ]
                ],
                {
                    color: '#7fb0d4',
                    weight: 1
                }
            ).addTo(window.aircraftMap);

            window.linhasRumo.push(linha);
        });
    }
        
    window.aircraftMap.fitBounds(bounds, {
        paddingTopLeft: [90, 90],
        paddingBottomRight: [50, 50]
    });

    setTimeout(() => {
        window.aircraftMap.invalidateSize();
    }, 100);
} // <--- ESSA CHAVE FECHA A FUNÇÃO CORRETAMENTE

async function buscarAeronavesProximas() {
// ... daqui para baixo continua o seu código original da busca de aeronaves
