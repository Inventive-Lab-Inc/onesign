/// Legacy auto-created label → current product name.
String displayWorkspaceName(String? name) {
  final trimmed = name?.trim() ?? '';
  if (trimmed.isEmpty) return 'Workspace';
  if (trimmed.toLowerCase() == 'default workspace') return 'Primary';
  return trimmed;
}
