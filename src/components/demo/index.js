import React from "react"
import injectSheet from 'react-jss'

const styles = theme => ({
  myDiv: {
    color: theme.colors.green,
    fontSize: theme.fontSizes.large
  }
})

const demo = ({ classes, children }) => {
  return (
    <React.Fragment>
      <div className={classes.myDiv}>{children}</div>
    </React.Fragment>
  )
}

export default injectSheet(styles)(demo);