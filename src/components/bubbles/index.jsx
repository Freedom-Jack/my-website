import React from "react"
import injectSheet from "react-jss"

// Bubble animation sass style sheet
import "../bubbles/bubbles_effect.sass"

// JSS style sheet
const styles = theme => ({
    bubbles_wrapper: {
        width: "100%",
        position: "fixed"
    }
})

// Component
const bubbles_theme = ({ classes }) => {
    return (
        <div className={classes.bubbles_wrapper}>
            {Array.from(Array(22).keys()).map((item, index) =>
                <div className="bubble" key={index}/>
            )}
        </div>
    )
}

export default injectSheet(styles)(bubbles_theme)