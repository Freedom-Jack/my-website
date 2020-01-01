import React from "react"
import injectSheet from "react-jss"

import "../bubbles/bubbles_effect.sass"

const styles = theme => ({
    bubbles_wrapper: {
        width: "100%",
        position: "fixed"
    }
})

const create_bubbles = () => {
    return <div class="bubble" />
}

const bubbles_theme = ({ classes }) => {
    return (
        <div className={classes.bubbles_wrapper}>
            {Array.from(Array(22).keys()).map((item, index) =>
                create_bubbles()
            )}
        </div>
    )
}

export default injectSheet(styles)(bubbles_theme)