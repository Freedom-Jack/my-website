import React from 'react'
import { ThemeProvider } from 'theming'
import my_theme from './theme'

// Page Components
import Jumbotron from './components/jumbotron'
import Wrapper from './components/wrapper'
import DemoBox from './components/demo'
import Bubbles from './components/bubbles'

function App() {
  return (
    <ThemeProvider theme={my_theme}>
      <React.Fragment>
        {/* Background Bubbles theme */} <Bubbles />
        <Jumbotron />

        {/* Page contents below*/}
        <Wrapper>
          <DemoBox amount={new Array(10)}>Yo check this out</DemoBox>
        </Wrapper>
      </React.Fragment>
    </ThemeProvider>
  );
}

export default App;
