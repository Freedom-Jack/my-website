import React from 'react'
import { ThemeProvider } from 'theming'

// Theming
import my_theme from './theme'

// Page Components
import Jumbotron from './components/jumbotron'
import Wrapper from './components/wrapper'
import DemoBox from './components/demo'
import Bubbles from './components/bubbles'

// Page Texts
import { Jumbotron_Text } from './texts'


// Functions
// Method for scrolling to a reference
const scrollToRef = (ref) => window.scrollTo({
  top: ref.current.offsetTop,
  behavior: "smooth"
})

// Contents
function App() {
  // Variables declaration
  const intro_ref = React.useRef(null)  // Reference to introduction

  return (
    <ThemeProvider theme={my_theme}>
      <React.Fragment>
        {/* Background Bubbles theme */} <Bubbles />
        <Jumbotron texts={Jumbotron_Text} explore={()=>scrollToRef(intro_ref)}/>

        {/* Page contents below*/}
        <Wrapper>
          <DemoBox reference={intro_ref}>Yo check this out</DemoBox>
        </Wrapper>
      </React.Fragment>
    </ThemeProvider>
  );
}

export default App;
