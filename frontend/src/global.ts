import { createGlobalStyle } from 'styled-components';

const GlobalStyle = createGlobalStyle`
  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
  }
  html, body, #root {
    min-height: 100%;
  }
`;

export default GlobalStyle;