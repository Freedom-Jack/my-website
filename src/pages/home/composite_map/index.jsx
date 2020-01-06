import React from "react"
import injectSheet from 'react-jss'
import { ComposableMap, Geographies, Geography, Sphere, Graticule } from "react-simple-maps"

import my_map from "./resources/countries.json"
import { Map_Data } from "./resources"

const styles = theme => ({
    div1: {
        // backgroundColor: "#9fd3ed",
        border: "visible",
        textAlign: "center"
    }
})

const map_style = {
    maxWidth: "80%",
    overflow: "visible"
}

const geo_part = (input, my_theme) => {
    const country_name = input.properties.NAME
    const rank = Map_Data[country_name]

    return (
        <Geography
            key={input.rsmKey}
            geography={input}
            fill={my_theme.map.gradient[rank] || my_theme.map.gradient.zero}
        />
    )
}

const composite_map = ({ classes, theme }) => (
    <div className={classes.div1}>
        <ComposableMap style={map_style}>
            <Sphere stroke={theme.map.stroke} strokeWidth={0.5} />
            <Graticule stroke={theme.map.stroke} strokeWidth={0.5} />
            <Geographies geography={my_map} >
                {({ geographies }) => geographies.map(geo => geo_part(geo, theme))}
            </Geographies>
        </ComposableMap>
    </div>

);

export default injectSheet(styles)(composite_map);
