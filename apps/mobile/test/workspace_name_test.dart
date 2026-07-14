import 'package:flutter_test/flutter_test.dart';
import 'package:onesign_console/core/workspace_name.dart';

void main() {
  group('displayWorkspaceName', () {
    test('renames legacy default label', () {
      expect(displayWorkspaceName('Default workspace'), 'Primary');
      expect(displayWorkspaceName('Default Workspace'), 'Primary');
      expect(displayWorkspaceName('  DEFAULT WORKSPACE  '), 'Primary');
    });

    test('keeps custom names', () {
      expect(displayWorkspaceName('London'), 'London');
      expect(displayWorkspaceName('Primary'), 'Primary');
    });
  });
}
