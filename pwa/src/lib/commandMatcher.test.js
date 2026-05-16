import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchCommand } from './commandMatcher.js';

test('mở cửa → OPEN',        () => assert.equal(matchCommand('mở cửa'), 'OPEN'));
test('Mở Cửa Cuốn → OPEN',   () => assert.equal(matchCommand('Mở Cửa Cuốn'), 'OPEN'));
test('mo cua → OPEN',         () => assert.equal(matchCommand('mo cua'), 'OPEN'));
test('lên → OPEN',            () => assert.equal(matchCommand('lên'), 'OPEN'));
test('dừng → STOP',           () => assert.equal(matchCommand('dừng'), 'STOP'));
test('dung → STOP',           () => assert.equal(matchCommand('dung'), 'STOP'));
test('stop → STOP',           () => assert.equal(matchCommand('stop'), 'STOP'));
test('đóng cửa → CLOSE',      () => assert.equal(matchCommand('đóng cửa'), 'CLOSE'));
test('xuống → CLOSE',         () => assert.equal(matchCommand('xuống'), 'CLOSE'));
test('abc xyz → null',        () => assert.equal(matchCommand('abc xyz'), null));
test('empty → null',          () => assert.equal(matchCommand(''), null));
test('mở dừng → STOP (priority)', () => assert.equal(matchCommand('mở dừng'), 'STOP'));
