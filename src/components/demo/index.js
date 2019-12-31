import React from "react";

// React-JSS
import injectSheet, {ThemeProvider} from 'react-jss'

const styles = {
  myDiv: {
    color: 'red'
  }
}

const demo = ({ classes, children }) => {
  return (
    <div className={classes.myDiv}>{children}</div>
  )
}

export default injectSheet(styles)(demo);