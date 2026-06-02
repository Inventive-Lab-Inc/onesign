package dev.signage.tv.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dev.signage.tv.R
import dev.signage.tv.ui.theme.SignageColors

@Composable
fun DeviceSetupScreen(
    installPermissionGranted: Boolean,
    onOpenSettingsClick: () -> Unit,
    onContinueClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxSize()
                .padding(horizontal = 48.dp, vertical = 40.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        SignageBrandHeaderTv()
        Spacer(modifier = Modifier.height(36.dp))
        Column(
            modifier =
                Modifier
                    .weight(1f)
                    .widthIn(max = 720.dp)
                    .fillMaxWidth(),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                text = stringResource(R.string.device_setup_title),
                style = MaterialTheme.typography.titleLarge,
                color = SignageColors.ThemeForegroundOnDark,
                textAlign = TextAlign.Center,
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = stringResource(R.string.device_setup_intro),
                style = MaterialTheme.typography.bodyLarge,
                color = SignageColors.ThemeForegroundOnDarkSoft,
                textAlign = TextAlign.Center,
            )
            Spacer(modifier = Modifier.height(28.dp))
            SetupStep(number = 1, text = stringResource(R.string.device_setup_step_open_settings))
            Spacer(modifier = Modifier.height(12.dp))
            SetupStep(number = 2, text = stringResource(R.string.device_setup_step_allow_installs))
            Spacer(modifier = Modifier.height(12.dp))
            SetupStep(number = 3, text = stringResource(R.string.device_setup_step_return))
            Spacer(modifier = Modifier.height(32.dp))
            if (installPermissionGranted) {
                Text(
                    text = stringResource(R.string.device_setup_permission_granted),
                    style = MaterialTheme.typography.bodyMedium,
                    color = SignageColors.Theme,
                    textAlign = TextAlign.Center,
                )
                Spacer(modifier = Modifier.height(20.dp))
                Button(onClick = onContinueClick) {
                    Text(stringResource(R.string.device_setup_continue))
                }
            } else {
                Text(
                    text = stringResource(R.string.device_setup_one_time_note),
                    style = MaterialTheme.typography.bodyMedium,
                    color = SignageColors.ThemeForegroundOnDarkSoft,
                    textAlign = TextAlign.Center,
                )
                Spacer(modifier = Modifier.height(20.dp))
                Button(onClick = onOpenSettingsClick) {
                    Text(stringResource(R.string.device_setup_open_settings))
                }
            }
        }
    }
}

@Composable
private fun SetupStep(
    number: Int,
    text: String,
) {
    Text(
        text = stringResource(R.string.device_setup_step_format, number, text),
        style = MaterialTheme.typography.bodyLarge,
        color = SignageColors.ThemeForegroundOnDark,
        textAlign = TextAlign.Center,
        modifier = Modifier.fillMaxWidth(),
    )
}
