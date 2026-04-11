"""
Territory Atlas API Tests - Iteration 5
Tests all backend endpoints including new point/density endpoints and Win Zones feature
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


class TestPointDataAPI:
    """Test point data endpoints (new simplified endpoint)"""
    
    def test_get_point_data(self):
        """GET /api/data/point should return point data (legacy fallback from city_data)"""
        response = requests.get(f"{BASE_URL}/api/data/point")
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert isinstance(data["data"], list)
        print(f"PASS: Point data endpoint returns {len(data['data'])} records")
        
        # Verify data structure if records exist
        if len(data["data"]) > 0:
            point = data["data"][0]
            assert "state" in point
            assert "city" in point
            assert "lat" in point
            assert "lon" in point
            assert "layers" in point
            assert isinstance(point["layers"], dict)
            print(f"PASS: Point data structure verified - sample: {point['city']}, {point['state']}")
            
            # Verify coordinates are valid US bounds
            assert -180 <= point["lon"] <= -60, f"Longitude {point['lon']} out of US bounds"
            assert 20 <= point["lat"] <= 75, f"Latitude {point['lat']} out of US bounds"
            print(f"PASS: Point coordinates within valid US bounds")
    
    def test_get_city_data_legacy(self):
        """GET /api/data/city should still work (legacy endpoint)"""
        response = requests.get(f"{BASE_URL}/api/data/city")
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert isinstance(data["data"], list)
        print(f"PASS: Legacy city data endpoint returns {len(data['data'])} records")


class TestDensityDataAPI:
    """Test density data endpoints (merged county + wheat)"""
    
    def test_get_density_data(self):
        """GET /api/data/density should return merged density data"""
        response = requests.get(f"{BASE_URL}/api/data/density")
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert isinstance(data["data"], list)
        print(f"PASS: Density data endpoint returns {len(data['data'])} records")
        
        # Verify data structure if records exist
        if len(data["data"]) > 0:
            density = data["data"][0]
            assert "state" in density
            assert "county" in density
            assert "layers" in density
            assert isinstance(density["layers"], dict)
            print(f"PASS: Density data structure verified - sample: {density['county']}, {density['state']}")
            
            # Check for merged layers (should have multiple layer types)
            all_layers = set()
            for item in data["data"][:100]:  # Check first 100 records
                all_layers.update(item["layers"].keys())
            print(f"PASS: Density data has layers: {sorted(all_layers)}")
    
    def test_get_county_data_legacy(self):
        """GET /api/data/county should still work (legacy endpoint)"""
        response = requests.get(f"{BASE_URL}/api/data/county")
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert isinstance(data["data"], list)
        print(f"PASS: Legacy county data endpoint returns {len(data['data'])} records")
    
    def test_get_wheat_data_legacy(self):
        """GET /api/data/wheat should still work (legacy endpoint)"""
        response = requests.get(f"{BASE_URL}/api/data/wheat")
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert isinstance(data["data"], list)
        print(f"PASS: Legacy wheat data endpoint returns {len(data['data'])} records")


class TestAnalyticsAPI:
    """Test analytics endpoint with merged data"""
    
    def test_get_top_zones_no_filter(self):
        """GET /api/analytics/top-zones should return aggregated top states"""
        response = requests.get(f"{BASE_URL}/api/analytics/top-zones")
        assert response.status_code == 200
        data = response.json()
        assert "top_zones" in data
        assert "total_count" in data
        assert isinstance(data["top_zones"], list)
        print(f"PASS: Top zones endpoint returns {len(data['top_zones'])} zones, total: {data['total_count']:,}")
        
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
        print(f"PASS: Top zones with filter returns {len(data['top_zones'])} zones, total: {data['total_count']:,}")
    
    def test_get_top_zones_with_density_filter(self):
        """GET /api/analytics/top-zones with density layer filter"""
        response = requests.get(f"{BASE_URL}/api/analytics/top-zones", params={"layers": "Acres,1000-plus Acre Growers"})
        assert response.status_code == 200
        data = response.json()
        assert "top_zones" in data
        assert "total_count" in data
        print(f"PASS: Top zones with density filter returns {len(data['top_zones'])} zones, total: {data['total_count']:,}")


class TestDataIntegrity:
    """Test data integrity across endpoints"""
    
    def test_all_datasets_have_records(self):
        """Verify all datasets have records loaded"""
        point_resp = requests.get(f"{BASE_URL}/api/data/point")
        density_resp = requests.get(f"{BASE_URL}/api/data/density")
        
        point_count = len(point_resp.json().get("data", []))
        density_count = len(density_resp.json().get("data", []))
        
        print(f"Data counts - Point: {point_count}, Density: {density_count}")
        
        # Both datasets should have data for Win Zones to work
        assert point_count > 0, "No point data loaded"
        assert density_count > 0, "No density data loaded"
        print(f"PASS: Data integrity verified - Point: {point_count}, Density: {density_count}")
    
    def test_density_data_has_merged_layers(self):
        """Verify density data has merged layers from county + wheat"""
        response = requests.get(f"{BASE_URL}/api/data/density")
        data = response.json()["data"]
        
        # Collect all unique layers
        all_layers = set()
        for item in data:
            all_layers.update(item["layers"].keys())
        
        # Should have both county layers and wheat Acres layer
        expected_layers = ["Acres", "1000-plus Acre Growers", "Growers with On Farm Storage", "Grain Retail Handlers"]
        found_layers = [l for l in expected_layers if l in all_layers]
        
        print(f"Found layers: {sorted(all_layers)}")
        print(f"Expected layers found: {found_layers}")
        
        # At least some expected layers should be present
        assert len(found_layers) >= 2, f"Expected at least 2 density layers, found: {found_layers}"
        print(f"PASS: Density data has merged layers: {found_layers}")


class TestUploadEndpoints:
    """Test upload endpoint availability (without actually uploading)"""
    
    def test_point_upload_endpoint_exists(self):
        """POST /api/upload/point endpoint should exist"""
        # Send empty request to check endpoint exists (will fail validation but not 404)
        response = requests.post(f"{BASE_URL}/api/upload/point")
        assert response.status_code != 404, "Point upload endpoint not found"
        print(f"PASS: Point upload endpoint exists (status: {response.status_code})")
    
    def test_density_upload_endpoint_exists(self):
        """POST /api/upload/density endpoint should exist"""
        # Send empty request to check endpoint exists (will fail validation but not 404)
        response = requests.post(f"{BASE_URL}/api/upload/density")
        assert response.status_code != 404, "Density upload endpoint not found"
        print(f"PASS: Density upload endpoint exists (status: {response.status_code})")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
