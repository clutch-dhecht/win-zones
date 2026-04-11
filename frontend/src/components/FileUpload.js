import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, FileUp } from 'lucide-react';

const FILE_TYPES = [
  { value: 'city', label: 'City Data', description: 'City/State with point layers' },
  { value: 'county', label: 'County Data', description: 'County/State with density layers' },
  { value: 'wheat', label: 'Wheat Acres', description: 'County/State acreage data' },
];

const FileUpload = ({ onCityUpload, onCountyUpload, onWheatUpload, loading }) => {
  const [selectedType, setSelectedType] = useState('city');
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (selectedType === 'city') onCityUpload(file);
    else if (selectedType === 'county') onCountyUpload(file);
    else if (selectedType === 'wheat') onWheatUpload(file);

    e.target.value = '';
  };

  const activeType = FILE_TYPES.find(t => t.value === selectedType);

  return (
    <div className="space-y-2" data-testid="file-upload-section">
      <Select value={selectedType} onValueChange={setSelectedType}>
        <SelectTrigger className="w-full h-9 text-sm bg-white" data-testid="file-type-selector">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FILE_TYPES.map(ft => (
            <SelectItem key={ft.value} value={ft.value} data-testid={`file-type-${ft.value}`}>
              <span className="font-medium">{ft.label}</span>
              <span className="text-stone-400 ml-1.5 text-xs">{ft.description}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileChange}
        className="hidden"
        data-testid="file-input"
      />

      <Button
        onClick={() => fileInputRef.current?.click()}
        disabled={loading}
        className="w-full bg-stone-800 hover:bg-stone-900 text-white h-9 text-sm"
        data-testid="upload-file-button"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Processing...
          </span>
        ) : (
          <>
            <FileUp className="w-4 h-4 mr-2" />
            Upload {activeType?.label || 'File'}
          </>
        )}
      </Button>
    </div>
  );
};

export default FileUpload;
