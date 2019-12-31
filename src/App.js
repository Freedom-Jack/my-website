import React from 'react';
import logo from './logo.svg';
import './App.css';

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
      <div className="App">
        <header className="App-header">
          <img src={logo} className="App-logo" alt="logo" />
          <p>
            Hello World
        </p>
          <a
            className="App-link"
            href="https://reactjs.org"
            target="_blank"
            rel="noopener noreferrer"
          >
            Learn React
        </a>
        </header>
      </div>

      {/* My contents after */}
      <Wrapper />
      <DemoBox />
    </React.Fragment>
  );
}

export default App;
