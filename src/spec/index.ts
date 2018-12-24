import {Config} from '../config';
import * as vlEncoding from '../encoding';
import {Field, FieldDef} from '../fielddef';
import {isPrimitiveMark} from '../mark';
import {stack} from '../stack';
import {Dict, hash, vals} from '../util';
import {DataMixins} from './base';
import {GenericHConcatSpec, GenericVConcatSpec, isConcatSpec, isVConcatSpec} from './concat';
import {GenericFacetSpec, isFacetSpec} from './facet';
import {ExtendedLayerSpec, GenericLayerSpec, isLayerSpec, NormalizedLayerSpec} from './layer';
import {GenericRepeatSpec, isRepeatSpec} from './repeat';
import {TopLevel} from './toplevel';
import {FacetedCompositeUnitSpec, GenericUnitSpec, isUnitSpec, NormalizedUnitSpec} from './unit';

export {normalizeTopLevelSpec as normalize} from '../normalize';
export {BaseSpec, DataMixins, LayoutSizeMixins} from './base';
export {
  GenericHConcatSpec,
  GenericVConcatSpec,
  isConcatSpec,
  isHConcatSpec,
  isVConcatSpec,
  NormalizedConcatSpec
} from './concat';
export {GenericFacetSpec, isFacetSpec, NormalizedFacetSpec} from './facet';
export {ExtendedLayerSpec, GenericLayerSpec, isLayerSpec, NormalizedLayerSpec} from './layer';
export {GenericRepeatSpec, isRepeatSpec, NormalizedRepeatSpec} from './repeat';
export {TopLevel} from './toplevel';
export {CompositeUnitSpec, FacetedCompositeUnitSpec, GenericUnitSpec, isUnitSpec, NormalizedUnitSpec} from './unit';

export type GenericSpec<U extends GenericUnitSpec<any, any>, L extends GenericLayerSpec<any>> =
  | U
  | L
  | GenericFacetSpec<U, L>
  | GenericRepeatSpec<U, L>
  | GenericVConcatSpec<U, L>
  | GenericHConcatSpec<U, L>;

export type NormalizedSpec = GenericSpec<NormalizedUnitSpec, NormalizedLayerSpec>;

export type TopLevelFacetedUnitSpec = TopLevel<FacetedCompositeUnitSpec> & DataMixins;
export type TopLevelFacetSpec = TopLevel<GenericFacetSpec<FacetedCompositeUnitSpec, ExtendedLayerSpec>> & DataMixins;

export type TopLevelSpec =
  | TopLevelFacetedUnitSpec
  | TopLevelFacetSpec
  | TopLevel<ExtendedLayerSpec>
  | TopLevel<GenericRepeatSpec<FacetedCompositeUnitSpec, ExtendedLayerSpec>>
  | TopLevel<GenericVConcatSpec<FacetedCompositeUnitSpec, ExtendedLayerSpec>>
  | TopLevel<GenericHConcatSpec<FacetedCompositeUnitSpec, ExtendedLayerSpec>>;

/* Custom type guards */

// TODO: add vl.spec.validate & move stuff from vl.validate to here

/* Accumulate non-duplicate fieldDefs in a dictionary */
function accumulate(dict: any, defs: FieldDef<Field>[]): any {
  defs.forEach(fieldDef => {
    // Consider only pure fieldDef properties (ignoring scale, axis, legend)
    const pureFieldDef = ['field', 'type', 'value', 'timeUnit', 'bin', 'aggregate'].reduce((f, key) => {
      if (fieldDef[key] !== undefined) {
        f[key] = fieldDef[key];
      }
      return f;
    }, {});
    const key = hash(pureFieldDef);
    dict[key] = dict[key] || fieldDef;
  });
  return dict;
}

/* Recursively get fieldDefs from a spec, returns a dictionary of fieldDefs */
function fieldDefIndex<T>(spec: GenericSpec<any, any>, dict: Dict<FieldDef<T>> = {}): Dict<FieldDef<T>> {
  // FIXME(https://github.com/vega/vega-lite/issues/2207): Support fieldDefIndex for repeat
  if (isLayerSpec(spec)) {
    spec.layer.forEach(layer => {
      if (isUnitSpec(layer)) {
        accumulate(dict, vlEncoding.fieldDefs(layer.encoding));
      } else {
        fieldDefIndex(layer, dict);
      }
    });
  } else if (isFacetSpec(spec)) {
    accumulate(dict, vlEncoding.fieldDefs(spec.facet));
    fieldDefIndex(spec.spec, dict);
  } else if (isRepeatSpec(spec)) {
    fieldDefIndex(spec.spec, dict);
  } else if (isConcatSpec(spec)) {
    const childSpec = isVConcatSpec(spec) ? spec.vconcat : spec.hconcat;
    childSpec.forEach(child => fieldDefIndex(child, dict));
  } else {
    // Unit Spec
    accumulate(dict, vlEncoding.fieldDefs(spec.encoding));
  }
  return dict;
}

/* Returns all non-duplicate fieldDefs in a spec in a flat array */
export function fieldDefs(spec: GenericSpec<any, any>): FieldDef<any>[] {
  return vals(fieldDefIndex(spec));
}

export function isStacked(spec: TopLevel<FacetedCompositeUnitSpec>, config?: Config): boolean {
  config = config || spec.config;
  if (isPrimitiveMark(spec.mark)) {
    return stack(spec.mark, spec.encoding, config ? config.stack : undefined) !== null;
  }
  return false;
}