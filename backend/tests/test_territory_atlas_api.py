"""
Territory Atlas API Tests
Tests for all backend endpoints: root, city data, county data, wheat data, and analytics
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestRootEndpoint:
    """Test the root API endpoint"""
    
    def test_root_returns_message(self):
        """GET /api/ should return welcome message"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert data["message"] == "Territory Atlas API"


class TestCityDataEndpoint:
    """Test city data retrieval endpoint"""
    
    def test_get_city_data_returns_200(self):
        """GET /api/data/city should return 200"""
        response = requests.get(f"{BASE_URL}/api/data/city")
        assert response.status_code == 200
    
    def test_get_city_data_structure(self):
        """GET /api/data/city should return proper data structure"""
        response = requests.get(f"{BASE_URL}/api/data/city")
        assert response.status_code == 200
        data = response.json()
        
        # Should have 'data' key
        assert "data" in data
        assert isinstance(data["data"], list)
    
    def test_city_data_has_required_fields(self):
        """Each city record should have required fields"""
        response = requests.get(f"{BASE_URL}/api/data/city")
        data = response.json()
        
        if len(data["data"]) > 0:
            city = data["data"][0]
            # Check required fields
            assert "state" in city
            assert "city" in city
            assert "lat" in city
            assert "lon" in city
            assert "layers" in city
            
            # Validate types
            assert isinstance(city["lat"], (int, float))
            assert isinstance(city["lon"], (int, float))
            assert isinstance(city["layers"], dict)
    
    def test_city_data_has_expected_layers(self):
        """City data should have expected layer types"""
        response = requests.get(f"{BASE_URL}/api/data/city")
        data = response.json()
        
        expected_layers = ["Feed Mills", "Hog Producers", "Grain Fumigation", "Customers"]
        
        if len(data["data"]) > 0:
            city = data["data"][0]
            for layer in expected_layers:
                assert layer in city["layers"], f"Missing layer: {layer}"


class TestCountyDataEndpoint:
    """Test county data retrieval endpoint"""
    
    def test_get_county_data_returns_200(self):
        """GET /api/data/county should return 200"""
        response = requests.get(f"{BASE_URL}/api/data/county")
        assert response.status_code == 200
    
    def test_get_county_data_structure(self):
        """GET /api/data/county should return proper data structure"""
        response = requests.get(f"{BASE_URL}/api/data/county")
        assert response.status_code == 200
        data = response.json()
        
        # Should have 'data' key
        assert "data" in data
        assert isinstance(data["data"], list)
    
    def test_county_data_has_required_fields(self):
        """Each county record should have required fields"""
        response = requests.get(f"{BASE_URL}/api/data/county")
        data = response.json()
        
        if len(data["data"]) > 0:
            county = data["data"][0]
            # Check required fields
            assert "state" in county
            assert "county" in county
            assert "layers" in county
            
            # Validate types
            assert isinstance(county["layers"], dict)
    
    def test_county_data_has_expected_layers(self):
        """County data should have expected layer types"""
        response = requests.get(f"{BASE_URL}/api/data/county")
        data = response.json()
        
        expected_layers = ["1000-plus Acre Growers", "Growers with On Farm Storage", "Grain Retail Handlers"]
        
        if len(data["data"]) > 0:
            county = data["data"][0]
            for layer in expected_layers:
                assert layer in county["layers"], f"Missing layer: {layer}"


class TestWheatDataEndpoint:
    """Test wheat data retrieval endpoint"""
    
    def test_get_wheat_data_returns_200(self):
        """GET /api/data/wheat should return 200"""
        response = requests.get(f"{BASE_URL}/api/data/wheat")
        assert response.status_code == 200
    
    def test_get_wheat_data_structure(self):
        """GET /api/data/wheat should return proper data structure"""
        response = requests.get(f"{BASE_URL}/api/data/wheat")
        assert response.status_code == 200
        data = response.json()
        
        # Should have 'data' key
        assert "data" in data
        assert isinstance(data["data"], list)
    
    def test_wheat_data_has_required_fields(self):
        """Each wheat record should have required fields"""
        response = requests.get(f"{BASE_URL}/api/data/wheat")
        data = response.json()
        
        if len(data["data"]) > 0:
            wheat = data["data"][0]
            # Check required fields
            assert "state" in wheat
            assert "county" in wheat
            assert "layers" in wheat
            
            # Validate types
            assert isinstance(wheat["layers"], dict)
    
    def test_wheat_data_has_acres_layer(self):
        """Wheat data should have Acres layer"""
        response = requests.get(f"{BASE_URL}/api/data/wheat")
        data = response.json()
        
        if len(data["data"]) > 0:
            wheat = data["data"][0]
            assert "Acres" in wheat["layers"], "Missing Acres layer in wheat data"


class TestAnalyticsEndpoint:
    """Test analytics/top-zones endpoint"""
    
    def test_get_top_zones_returns_200(self):
        """GET /api/analytics/top-zones should return 200"""
        response = requests.get(f"{BASE_URL}/api/analytics/top-zones")
        assert response.status_code == 200
    
    def test_get_top_zones_structure(self):
        """GET /api/analytics/top-zones should return proper structure"""
        response = requests.get(f"{BASE_URL}/api/analytics/top-zones")
        data = response.json()
        
        # Should have required keys
        assert "top_zones" in data
        assert "total_count" in data
        assert isinstance(data["top_zones"], list)
        assert isinstance(data["total_count"], (int, float))
    
    def test_top_zones_with_layer_filter(self):
        """GET /api/analytics/top-zones with layers param should filter results"""
        response = requests.get(f"{BASE_URL}/api/analytics/top-zones?layers=Feed+Mills,Customers")
        assert response.status_code == 200
        data = response.json()
        
        assert "top_zones" in data
        assert "total_count" in data
    
    def test_top_zones_zone_structure(self):
        """Each zone in top_zones should have state and total"""
        response = requests.get(f"{BASE_URL}/api/analytics/top-zones")
        data = response.json()
        
        if len(data["top_zones"]) > 0:
            zone = data["top_zones"][0]
            assert "state" in zone
            assert "total" in zone
            assert isinstance(zone["total"], (int, float))
    
    def test_top_zones_returns_max_10(self):
        """Top zones should return at most 10 results"""
        response = requests.get(f"{BASE_URL}/api/analytics/top-zones")
        data = response.json()
        
        assert len(data["top_zones"]) <= 10


class TestDataIntegrity:
    """Test data integrity across endpoints"""
    
    def test_city_data_has_records(self):
        """City data should have records loaded"""
        response = requests.get(f"{BASE_URL}/api/data/city")
        data = response.json()
        assert len(data["data"]) > 0, "No city data loaded"
    
    def test_county_data_has_records(self):
        """County data should have records loaded"""
        response = requests.get(f"{BASE_URL}/api/data/county")
        data = response.json()
        assert len(data["data"]) > 0, "No county data loaded"
    
    def test_wheat_data_has_records(self):
        """Wheat data should have records loaded"""
        response = requests.get(f"{BASE_URL}/api/data/wheat")
        data = response.json()
        assert len(data["data"]) > 0, "No wheat data loaded"
    
    def test_city_coordinates_valid(self):
        """City coordinates should be within valid US bounds"""
        response = requests.get(f"{BASE_URL}/api/data/city")
        data = response.json()
        
        for city in data["data"][:10]:  # Check first 10
            # US bounds approximately: lat 24-50, lon -125 to -66
            assert 18 <= city["lat"] <= 72, f"Invalid latitude for {city['city']}: {city['lat']}"
            assert -180 <= city["lon"] <= -60, f"Invalid longitude for {city['city']}: {city['lon']}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
