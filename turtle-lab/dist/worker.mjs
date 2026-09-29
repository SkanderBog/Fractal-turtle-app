import {generatePath} from './core.mjs';
self.onmessage = ({data}) => {
  try {
    const result = generatePath(data);
    self.postMessage({result},[result.points.buffer,result.steps.buffer,result.remainders.buffer,result.headings.buffer,result.moved.buffer,result.turnPrefix.buffer]);
  } catch(error) { self.postMessage({error:error.message}); }
};
