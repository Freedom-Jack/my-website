import React from "react"
import injectSheet from "react-jss"

const styles = theme => ({
    wrapper: {
        margin: "auto",
        width: "77.5%",
        maxWidth: 1920
    }
})

const wrapper = ({ classes, children }) => {
    return (
        <div className={classes.wrapper}>{children}</div>
    )
}

export default injectSheet(styles)(wrapper);