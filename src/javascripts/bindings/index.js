import ko from 'knockout';
import railway from 'knockout-railway';
import koInview from "knockout-inview";

ko.bindingHandlers.railway = railway(ko);

export const inview = koInview(ko);
export {default as backgroundVideo} from './background-video';
export {default as imageLoaded} from './image-loaded';
export {default as slides} from './slides';
export {default as gallery} from './gallery';
