import React from "react";
import ReactDOM from "react-dom";
import injectSheet from 'react-jss'
import { ComposableMap, ZoomableGroup, Geographies, Geography } from "react-simple-maps";

import my_map from "./countries.json"

const styles = theme => ({
    div1: {
        backgroundColor: "#9fd3ed",
    }
})

const map_style = {
    maxHeight: "520"
}


const composite_map = ({ classes }) => (
    <div className={classes.div1}>
        <ComposableMap style={map_style}>
            <Geographies geography={my_map} >
                {({ geographies }) =>
                    geographies.map(geo => <Geography key={geo.rsmKey} geography={geo} />)
                }
            </Geographies>
        </ComposableMap>
    </div>

);

export default injectSheet(styles)(composite_map);
