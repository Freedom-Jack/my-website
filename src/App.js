import React from 'react';

// React-JSS
import { ThemeProvider } from 'theming';

// Components
import Jumbotron from './components/jumbotron'
import Wrapper from './components/wrapper'
import DemoBox from './components/demo'


// Website contents
const theme = {
  color: 'black',
  background: 'white',
};


function App() {
  return (
    <React.Fragment>
      {/* My contents after */}
      <Wrapper />
      <DemoBox>Yo check this out</DemoBox>
    </React.Fragment>
  );
}

export default App;
