const React = require("react");

exports.onRenderBody = ({ setHeadComponents }) => {
  setHeadComponents([
    <style type="text/css" key="gatsby-remark-images-styles">
      {
        `img.fluid {
          width: 100%;
          height: 100%;
          margin: 0;
          vertical-align: middle;
          position: absolute;
          top: 0;
          left: 0;
          color: transparent;
        }
        
        span.fluid.preview {
          display: block;
          position: relative; 
          bottom: 0; left: 0; 
          background-size: cover; 
        }`
      }
    </style>,
  ])
};
