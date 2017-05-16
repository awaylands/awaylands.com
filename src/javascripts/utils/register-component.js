import ko from 'knockout';

const defaultTemplate = `
<!-- ko template: {nodes: $componentTemplateNodes, afterRender: afterRender} --><!-- /ko -->
`;

function registerComponent({name, template, app, ViewModel}) {
  ko.components.register(name, {
    viewModel: {
      createViewModel: (params, componentInfo) => {
      const viewModel = new ViewModel({params, componentInfo, app});
  if (!viewModel.afterRender) {
    viewModel.afterRender = () => {};
  }
  return viewModel;
}
},
  template: template ? {element: template} : defaultTemplate
});
}

export default registerComponent;
