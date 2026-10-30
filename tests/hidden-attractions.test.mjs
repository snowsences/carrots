import test from 'node:test';
import assert from 'node:assert/strict';
import {hiddenAttractionId,normalizeHiddenAttraction} from '../hidden-attractions.js';

test('builds and normalizes a shared hidden-attraction record',()=>{
 const id=hiddenAttractionId('italy-guide','venice','rialto-bridge');
 assert.equal(id,'italy-guide::venice::rialto-bridge');
 assert.deepEqual(normalizeHiddenAttraction({id,guideId:'italy-guide',dayId:'venice',attractionId:'rialto-bridge',updatedAt:42}),{id,guideId:'italy-guide',dayId:'venice',attractionId:'rialto-bridge',updatedAt:42});
});

test('rejects mismatched or unsafe hidden-attraction IDs',()=>{
 assert.throws(()=>normalizeHiddenAttraction({id:'wrong',guideId:'guide',dayId:'place',attractionId:'site',updatedAt:1}),/does not match/);
 assert.throws(()=>hiddenAttractionId('guide','bad/place','site'),/invalid/);
});
