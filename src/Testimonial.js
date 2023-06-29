import React from 'react';

const Testimonial = ({ testimonial }) => {
  return (
    <div>
      <h3>{testimonial.name}</h3>
      <p>{testimonial.comment}</p>
    </div>
  );
};

export default Testimonial;
