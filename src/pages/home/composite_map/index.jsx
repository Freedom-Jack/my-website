import React from "react"
import injectSheet from 'react-jss'
import { ComposableMap, Geographies, Geography, Sphere, Graticule } from "react-simple-maps"

import my_map from "./resources/countries.json"
import { Map_Data } from "./resources"

const styles = theme => ({
    container: {
        border: "visible",
        textAlign: "center"
    }
})

const map_style = {
    maxWidth: "80%",
    overflow: "visible"
}

const geo_part = (input, my_theme, setTip) => {
    const country_name = input.properties.NAME
    const country_rank = Map_Data[country_name] ? Map_Data[country_name]["level"] : "zero"
    const country_info = Map_Data[country_name] ? country_name : ""

    return (
        <Geography
            key={input.rsmKey}
            geography={input}
            fill={my_theme.map.gradient[country_rank]}
            onMouseEnter={() => {
                setTip(`"${country_info}" information`);
              }}
            onMouseLeave={() => {
                setTip("");
              }}
        />
    )
}

const composite_map = ({ classes, theme, setTooltipContent }) => (
    <div className={classes.container}>
        <ComposableMap style={map_style} data-tip="">
            <Sphere stroke={theme.map.stroke} strokeWidth={0.5} />
            <Graticule stroke={theme.map.stroke} strokeWidth={0.5} />
            <Geographies geography={my_map} >
                {({ geographies }) => geographies.map(geo => geo_part(geo, theme, setTooltipContent))}
            </Geographies>
        </ComposableMap>
    </div>

);

export default injectSheet(styles)(composite_map);
