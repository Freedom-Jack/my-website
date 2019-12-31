import React from 'react';
import { withTheme } from 'theming';

const DemoBox = props => {
  console.log(props.theme);
  return (<div>hello world</div>);
}

export default withTheme(DemoBox);