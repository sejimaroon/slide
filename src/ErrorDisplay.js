import React from 'react';

export const ErrorDisplay = ({ errorMessage }) => {
  if (!errorMessage) {
    return null;
  }

  return (
    <div className="error">
      <p>{errorMessage}</p>
    </div>
  );
};

export default ErrorDisplay;
