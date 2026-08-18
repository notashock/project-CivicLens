import math
from typing import Tuple, Dict, Any

DIGIPIN_ALPHABET = [
    '2', '3', '4', '5',
    '6', '7', '8', '9',
    'C', 'F', 'J', 'K',
    'M', 'P', 'R', 'W',
]

DIGIPIN_BOUNDS = {
    "min_lat": 2.5,
    "max_lat": 39.5,
    "min_lon": 64.5,
    "max_lon": 99.5,
}

def encode_digipin(lat: float, lon: float, precision: int = 10) -> str:
    if not (DIGIPIN_BOUNDS["min_lat"] <= lat <= DIGIPIN_BOUNDS["max_lat"]):
        raise ValueError(f"Latitude {lat} outside India DIGIPIN bounds")
    if not (DIGIPIN_BOUNDS["min_lon"] <= lon <= DIGIPIN_BOUNDS["max_lon"]):
        raise ValueError(f"Longitude {lon} outside India DIGIPIN bounds")

    min_lat = DIGIPIN_BOUNDS["min_lat"]
    max_lat = DIGIPIN_BOUNDS["max_lat"]
    min_lon = DIGIPIN_BOUNDS["min_lon"]
    max_lon = DIGIPIN_BOUNDS["max_lon"]

    result = []
    for _ in range(precision):
        lat_span = (max_lat - min_lat) / 4.0
        lon_span = (max_lon - min_lon) / 4.0

        row = int((lat - min_lat) / lat_span)
        if row >= 4: row = 3
        if row < 0: row = 0

        col = int((lon - min_lon) / lon_span)
        if col >= 4: col = 3
        if col < 0: col = 0

        matrix_row = 3 - row
        char_index = matrix_row * 4 + col
        result.append(DIGIPIN_ALPHABET[char_index])

        min_lat = min_lat + row * lat_span
        max_lat = min_lat + lat_span
        min_lon = min_lon + col * lon_span
        max_lon = min_lon + lon_span

    return "".join(result)

def decode_digipin(digipin: str) -> Dict[str, Any]:
    clean = digipin.replace("-", "").replace(" ", "").upper()
    if not clean:
        raise ValueError("Empty DIGIPIN")

    min_lat = DIGIPIN_BOUNDS["min_lat"]
    max_lat = DIGIPIN_BOUNDS["max_lat"]
    min_lon = DIGIPIN_BOUNDS["min_lon"]
    max_lon = DIGIPIN_BOUNDS["max_lon"]

    for i, char in enumerate(clean):
        if char not in DIGIPIN_ALPHABET:
            raise ValueError(f"Invalid DIGIPIN character '{char}' at position {i}")
        index = DIGIPIN_ALPHABET.index(char)
        matrix_row = index // 4
        col = index % 4
        row = 3 - matrix_row

        lat_span = (max_lat - min_lat) / 4.0
        lon_span = (max_lon - min_lon) / 4.0

        min_lat = min_lat + row * lat_span
        max_lat = min_lat + lat_span
        min_lon = min_lon + col * lon_span
        max_lon = min_lon + lon_span

    return {
        "centroid": {
            "lat": (min_lat + max_lat) / 2.0,
            "lon": (min_lon + max_lon) / 2.0,
        },
        "bounds": {
            "min_lat": min_lat,
            "max_lat": max_lat,
            "min_lon": min_lon,
            "max_lon": max_lon,
        },
        "precision": len(clean),
    }

def haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371000.0  # Earth radius in meters
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (math.sin(d_lat / 2.0) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(d_lon / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c
