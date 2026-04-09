import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';

const FileUpload = ({ onCityUpload, onCountyUpload, loading }) => {
  const cityInputRef = useRef(null);
  const countyInputRef = useRef(null);

  const handleCityChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onCityUpload(file);
      e.target.value = '';
    }
  };

  const handleCountyChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onCountyUpload(file);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <input
          ref={cityInputRef}
          type="file"
          accept=".csv"
          onChange={handleCityChange}
          className="hidden"
          data-testid="city-file-input"
        />
        <Button
          onClick={() => cityInputRef.current?.click()}
          disabled={loading}
          className="w-full bg-green-700 hover:bg-green-800 text-white"
          data-testid="upload-city-button"
        >
          <Upload className="w-4 h-4 mr-2" />
          Upload City Data
        </Button>
      </div>

      <div>
        <input
          ref={countyInputRef}
          type="file"
          accept=".csv"
          onChange={handleCountyChange}
          className="hidden"
          data-testid="county-file-input"
        />
        <Button
          onClick={() => countyInputRef.current?.click()}
          disabled={loading}
          className="w-full bg-green-700 hover:bg-green-800 text-white"
          data-testid="upload-county-button"
        >
          <Upload className="w-4 h-4 mr-2" />
          Upload County Data
        </Button>
      </div>
    </div>
  );
};

export default FileUpload;
