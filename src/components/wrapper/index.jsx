import React from "react"
import injectSheet from "react-jss"

// JSS style sheet
const styles = theme => ({
    wrapper: {
        margin: "auto",
        width: "75%",
        maxWidth: 1440
    }
})

// Component
const wrapper = ({ classes, children }) => {
    return (
        <div className={classes.wrapper}>{children}</div>
    )
}

export default injectSheet(styles)(wrapper);