#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const innerPath = path.join(root, '_takeshape-schema-export/schema-inner.json');
const exportPath = path.join(root, '_takeshape-schema-export/schema.json');
const inner = JSON.parse(fs.readFileSync(innerPath, 'utf8'));
const exported = JSON.parse(fs.readFileSync(exportPath, 'utf8'));

const relationship = (shape, mapping, backreference) => {
  const field = {
    type: 'array',
    items: {'@ref': `local:${shape}`},
    '@input': {type: 'array', items: {'@ref': 'local:TSRelationship'}},
    '@args': 'TSRelationshipArgs',
    '@resolver': {
      name: 'shapedb:getRelated',
      service: 'shapedb',
      options: {nullable: true}
    },
    '@mapping': mapping
  };
  if (backreference) field['@backreference'] = {enabled: true};
  return field;
};

const singleRelationship = (shape, mapping) => ({
  '@ref': `local:${shape}`,
  '@input': {'@ref': 'local:TSRelationship'},
  '@args': 'TSRelationshipArgs',
  '@resolver': {
    name: 'shapedb:getRelated',
    service: 'shapedb',
    options: {nullable: true}
  },
  '@mapping': mapping
});

inner.forms.MainCategory = {
  default: {
    properties: {title: {widget: 'singleLineText'}},
    order: ['title'],
    widget: 'object'
  }
};

inner.shapes.MainCategory = {
  id: 'AwayLandsMainCategoryV1',
  name: 'MainCategory',
  title: 'Main Category',
  workflow: 'default',
  model: {type: 'taxonomy'},
  schema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        title: 'Category Name',
        minLength: 1,
        '@mapping': 'shapedb:MainCategory.TitleV1'
      }
    },
    required: ['title']
  }
};

inner.forms.Story.default.properties.mainCategory = {
  widget: 'relationship',
  title: 'Category',
  instructions: 'Choose every main category for this post. If a subcategory is selected, also select its parent category here so Story searches find the post in both.'
};
inner.forms.Story.default.properties.category.title = 'Sub Category';
inner.forms.Story.default.properties.category.instructions = 'Choose any specific subcategories for this post.';
inner.shapes.Story.schema.properties.category.title = 'Sub Category';
inner.forms.Story.default.order = inner.forms.Story.default.order.filter(field => field !== 'mainCategory');
inner.forms.Story.default.order.splice(inner.forms.Story.default.order.indexOf('category'), 0, 'mainCategory');
inner.shapes.Story.schema.properties.mainCategory = Object.assign(
  {title: 'Category'},
  relationship('MainCategory', 'shapedb:Story.MainCategoryV1', true)
);

inner.forms.Category.default.properties.mainCategoryTag = {
  widget: 'relationship',
  title: 'Native Main Category Tag',
  instructions: 'Connect a main category page to its native Story editor tag. Leave blank on subcategory pages.'
};
inner.forms.Category.default.order = inner.forms.Category.default.order.filter(field => field !== 'mainCategoryTag');
inner.forms.Category.default.order.splice(inner.forms.Category.default.order.indexOf('parentCategory') + 1, 0, 'mainCategoryTag');
inner.shapes.Category.schema.properties.mainCategoryTag = Object.assign(
  {title: 'Native Main Category Tag'},
  singleRelationship('MainCategory', 'shapedb:Category.MainCategoryTagV1')
);

const query = (action, shape, result, description) => ({
  args: `${action}<${shape}>`,
  resolver: {
    name: `shapedb:${result}`,
    service: 'shapedb',
    shapeName: shape
  },
  shape: description,
  description: `${result.charAt(0).toUpperCase() + result.slice(1)} ${shape}`
});

inner.queries.getMainCategory = query('TSGetArgs', 'MainCategory', 'get', 'MainCategory');
inner.queries.getMainCategoryList = query('TSListArgs', 'MainCategory', 'list', 'PaginatedList<MainCategory>');
inner.queries.getMainCategoryList.description = 'Returns a list MainCategory in natural order.';
inner.mutations.updateMainCategory = query('UpdateArgs', 'MainCategory', 'update', 'UpdateResult<MainCategory>');
inner.mutations.createMainCategory = query('CreateArgs', 'MainCategory', 'create', 'CreateResult<MainCategory>');
inner.mutations.duplicateMainCategory = query('DuplicateArgs', 'MainCategory', 'duplicate', 'DuplicateResult<MainCategory>');
inner.mutations.deleteMainCategory = query('DeleteArgs', 'MainCategory', 'delete', 'DeleteResult<MainCategory>');

exported.schema = inner;
fs.writeFileSync(innerPath, `${JSON.stringify(inner, null, 2)}\n`);
fs.writeFileSync(exportPath, `${JSON.stringify(exported, null, 2)}\n`);

console.log('Added native Main Category taxonomy and Story editor relationships.');
