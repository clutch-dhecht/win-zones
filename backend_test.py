import requests
import sys
import json
from datetime import datetime

class TerritoryAtlasAPITester:
    def __init__(self, base_url="https://territory-atlas.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'} if not files else {}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                if files:
                    response = requests.post(url, files=files)
                else:
                    response = requests.post(url, json=data, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    if isinstance(response_data, dict):
                        if 'data' in response_data:
                            print(f"   Data count: {len(response_data['data'])}")
                        elif 'processed' in response_data:
                            print(f"   Processed: {response_data['processed']}")
                        elif 'top_zones' in response_data:
                            print(f"   Top zones count: {len(response_data['top_zones'])}")
                except:
                    pass
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Response: {response.text[:200]}")

            return success, response.json() if response.headers.get('content-type', '').startswith('application/json') else {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test the root API endpoint"""
        return self.run_test("Root API", "GET", "", 200)

    def test_status_endpoints(self):
        """Test status check endpoints"""
        # Test creating a status check
        success, response = self.run_test(
            "Create Status Check",
            "POST",
            "status",
            200,
            data={"client_name": "test_client"}
        )
        
        # Test getting status checks
        self.run_test("Get Status Checks", "GET", "status", 200)
        
        return success

    def test_get_city_data(self):
        """Test getting city data"""
        return self.run_test("Get City Data", "GET", "data/city", 200)

    def test_get_county_data(self):
        """Test getting county data"""
        return self.run_test("Get County Data", "GET", "data/county", 200)

    def test_analytics_endpoint(self):
        """Test analytics endpoint"""
        # Test without layers parameter
        success1, _ = self.run_test("Analytics - No Layers", "GET", "analytics/top-zones", 200)
        
        # Test with layers parameter
        success2, _ = self.run_test("Analytics - With Layers", "GET", "analytics/top-zones?layers=layer1,layer2", 200)
        
        return success1 and success2

    def test_file_upload_endpoints(self):
        """Test file upload endpoints (without actual files)"""
        print("\n🔍 Testing File Upload Endpoints (without files)...")
        
        # Test city upload endpoint (should fail without file)
        success1, _ = self.run_test("City Upload - No File", "POST", "upload/city", 422)
        
        # Test county upload endpoint (should fail without file)
        success2, _ = self.run_test("County Upload - No File", "POST", "upload/county", 422)
        
        return success1 and success2

def main():
    print("🚀 Starting Territory Atlas API Testing...")
    print("=" * 50)
    
    # Setup
    tester = TerritoryAtlasAPITester()
    
    # Run tests
    print("\n📡 Testing Basic Endpoints...")
    tester.test_root_endpoint()
    tester.test_status_endpoints()
    
    print("\n📊 Testing Data Endpoints...")
    tester.test_get_city_data()
    tester.test_get_county_data()
    
    print("\n📈 Testing Analytics...")
    tester.test_analytics_endpoint()
    
    print("\n📁 Testing Upload Endpoints...")
    tester.test_file_upload_endpoints()
    
    # Print results
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print("⚠️  Some tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())