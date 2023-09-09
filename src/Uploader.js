import React, { useState } from 'react';
import axios from 'axios';

const Uploader= () => {
  const [selectedFiles, setSelectedFiles] = useState([]);

  const handleFileSelect = (event) => {
    setSelectedFiles(event.target.files);
  };

  const handleFormSubmit = async (event) => {
    event.preventDefault();

    const formData = new FormData();
    for (const file of selectedFiles) {
      formData.append('files', file);
    }

    try {
      await axios.post('/upload', formData);
      console.log('File uploaded successfully');
    } catch (error) {
      console.error('Error uploading file:', error);
    }
  };

  return (
    <form onSubmit={handleFormSubmit}>
      <input type="file" multiple onChange={handleFileSelect} />
      <button type="submit">Upload</button>
    </form>
  );
};

export default Uploader;
