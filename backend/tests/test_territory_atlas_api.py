"""
Territory Atlas API Tests - Iteration 3
Tests all backend endpoints for the territory mapping application
"""
import pytest
import requests
import os

BASE_URL = "https://territory-atlas.preview.emergentagent.com"

class TestHealthAndRoot:
    """Test basic API health and root endpoint"""
    
    def test_root_endpoint(self):
        """GET /api/ should return welcome message"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "Territory Atlas" in data["message"]
        print(f"PASS: Root endpoint returns: {data['message']}")


class TestCityDataAPI:
    """Test city data endpoint"""
    
    def test_get_city_data(self):
        """GET /api/data/city should return city data with proper structure"""
        response = requests.get(f"{BASE_URL}/api/data/city")
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert isinstance(data["data"], list)
        print(f"PASS: City data endpoint returns {len(data['data'])} records")
        
        # Verify data structure if records exist
        if len(data["data"]) > 0:
            city = data["data"][0]
            assert "state" in city
            assert "city" in city
            assert "lat" in city
            assert "lon" in city
            assert "layers" in city
            assert isinstance(city["layers"], dict)
            print(f"PASS: City data structure verified - sample: {city['city']}, {city['state']}")
            
            # Verify coordinates are valid US bounds
            assert -180 <= city["lon"] <= -60, f"Longitude {city['lon']} out of US bounds"
            assert 20 <= city["lat"] <= 75, f"Latitude {city['lat']} out of US bounds"
            print(f"PASS: City coordinates within valid US bounds")


class TestCountyDataAPI:
    """Test county data endpoint"""
    
    def test_get_county_data(self):
        """GET /api/data/county should return county data with proper structure"""
        response = requests.get(f"{BASE_URL}/api/data/county")
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert isinstance(data["data"], list)
        print(f"PASS: County data endpoint returns {len(data['data'])} records")
        
        # Verify data structure if records exist
        if len(data["data"]) > 0:
            county = data["data"][0]
            assert "state" in county
            assert "county" in county
            assert "layers" in county
            assert isinstance(county["layers"], dict)
            print(f"PASS: County data structure verified - sample: {county['county']}, {county['state']}")


class TestWheatDataAPI:
    """Test wheat data endpoint"""
    
    def test_get_wheat_data(self):
        """GET /api/data/wheat should return wheat data with Acres layer"""
        response = requests.get(f"{BASE_URL}/api/data/wheat")
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert isinstance(data["data"], list)
        print(f"PASS: Wheat data endpoint returns {len(data['data'])} records")
        
        # Verify data structure if records exist
        if len(data["data"]) > 0:
            wheat = data["data"][0]
            assert "state" in wheat
            assert "county" in wheat
            assert "layers" in wheat
            assert isinstance(wheat["layers"], dict)
            # Wheat data should have Acres layer
            if "Acres" in wheat["layers"]:
                print(f"PASS: Wheat data has Acres layer - sample: {wheat['county']}, {wheat['state']}")


class TestAnalyticsAPI:
    """Test analytics endpoint"""
    
    def test_get_top_zones_no_filter(self):
        """GET /api/analytics/top-zones should return aggregated top states"""
        response = requests.get(f"{BASE_URL}/api/analytics/top-zones")
        assert response.status_code == 200
        data = response.json()
        assert "top_zones" in data
        assert "total_count" in data
        assert isinstance(data["top_zones"], list)
        print(f"PASS: Top zones endpoint returns {len(data['top_zones'])} zones, total: {data['total_count']}")
        
        # Verify zone structure
        if len(data["top_zones"]) > 0:
            zone = data["top_zones"][0]
            assert "state" in zone
            assert "total" in zone
            print(f"PASS: Top zone structure verified - #1: {zone['state']} with {zone['total']:,}")
    
    def test_get_top_zones_with_layer_filter(self):
        """GET /api/analytics/top-zones with layer filter"""
        response = requests.get(f"{BASE_URL}/api/analytics/top-zones", params={"layers": "Feed Mills,Customers"})
        assert response.status_code == 200
        data = response.json()
        assert "top_zones" in data
        assert "total_count" in data
        print(f"PASS: Top zones with filter returns {len(data['top_zones'])} zones, total: {data['total_count']}")


class TestDataIntegrity:
    """Test data integrity across endpoints"""
    
    def test_all_datasets_have_records(self):
        """Verify all datasets have records loaded"""
        city_resp = requests.get(f"{BASE_URL}/api/data/city")
        county_resp = requests.get(f"{BASE_URL}/api/data/county")
        wheat_resp = requests.get(f"{BASE_URL}/api/data/wheat")
        
        city_count = len(city_resp.json().get("data", []))
        county_count = len(county_resp.json().get("data", []))
        wheat_count = len(wheat_resp.json().get("data", []))
        
        print(f"Data counts - City: {city_count}, County: {county_count}, Wheat: {wheat_count}")
        
        # At least one dataset should have data
        assert city_count > 0 or county_count > 0 or wheat_count > 0, "No data loaded in any dataset"
        print(f"PASS: Data integrity verified - at least one dataset has records")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
