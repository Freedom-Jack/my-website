import React from "react"
import injectSheet from "react-jss"

import { Jumbotron, Button } from "react-bootstrap"

const styles = theme => ({
    jumbotron: {
        height: "67.5vh",
        background: "linear-gradient(90deg, #C6FFDD, #FBD786, #f64f59)",
        backgroundSize: "500%, 500%",
        animation: "gradient 15s ease infinite"
    },
    content: {
        margin: "auto"
    },
    heading: {
        color: theme.colors.white,
        fontSize: theme.fontSizes.extra,
        textAlign: "center"
    },
    "@keyframes gradient": {
        '0%, 100%': {
            backgroundPosition: "25% 50%"
        },
        '50%': {
            backgroundPosition: "75% 50%"
        }
    }
})

const jumbotron = ({ classes, amount }) => {
    return (
        <Jumbotron className={classes.jumbotron}>
            <h1 className={classes.heading}>Welcome to Jack's website</h1>
            <p>
                This is a simple hero unit, a simple jumbotron-style component for calling extra attention to featured content or information.
                </p>
            <p>
                <Button variant="primary">Learn more</Button>
            </p>
        </Jumbotron>
    )
}

export default injectSheet(styles)(jumbotron);