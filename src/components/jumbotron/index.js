import React from "react"
import injectSheet from "react-jss"

import { Jumbotron, Button } from "react-bootstrap"

const styles = theme => ({
    jumbotron: {
        height: "67.5vh",
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(90deg, #C6FFDD, #FBD786, #f64f59)",
        backgroundSize: "500%, 500%",
        animation: "gradient 15s ease infinite"
    },
    heading: {
        color: theme.colors.white,
        fontSize: theme.fontSizes.extra,
        textAlign: "center"
    },
    content: {
        margin: "35px auto",
        width: "61.8%",
        flexGrow: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-around"
    },
    description: {
        fontSize: theme.fontSizes.medium
    },
    author: {
        width: "100%",
        fontSize: theme.fontSizes.small,
        textAlign: "right"
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

const jumbotron = ({ classes, texts, explore }) => {
    return (
        <Jumbotron className={classes.jumbotron}>
            <h1 className={classes.heading}>{texts.heading}</h1>
            <div className={classes.content}>
                <div className={classes.description}>{texts.description}</div>
                <div className={classes.author}>&mdash; {texts.author}</div>
                <p>
                    <Button variant="outline-dark" onClick={explore}>{texts.button}</Button>
                </p>
            </div>
        </Jumbotron>
    )
}

export default injectSheet(styles)(jumbotron);