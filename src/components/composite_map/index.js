import React from "react";
import ReactDOM from "react-dom";
import injectSheet from 'react-jss'
import { ComposableMap, ZoomableGroup, Geographies, Geography } from "react-simple-maps";

import my_map from "../../maps/countries.json"

const styles = theme => ({
    div1: {
        backgroundColor: "#9fd3ed"
    }
})


const composite = ({ classes }) => (
    <div className={classes.div1}>
        <ComposableMap>
                <Geographies geography={my_map}>
                    {geographies =>
                        geographies.map(geo => <Geography key={geo.rsmKey} geography={geo} />)
                    }
                </Geographies>
        </ComposableMap>
    </div>

);

export default injectSheet(styles)(composite);
