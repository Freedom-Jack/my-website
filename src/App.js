import React from 'react'
import { ThemeProvider } from 'theming'
import my_theme from './theme'

// Components
import Jumbotron from './components/jumbotron'
import Wrapper from './components/wrapper'
import DemoBox from './components/demo'



function App() {
  return (
    <ThemeProvider theme={my_theme}>
      <React.Fragment>
        <Jumbotron />
        
        {/* Page contents */}
        <Wrapper>
          <DemoBox>Yo check this out</DemoBox>
        </Wrapper>
      </React.Fragment>
    </ThemeProvider>
  );
}

export default App;
